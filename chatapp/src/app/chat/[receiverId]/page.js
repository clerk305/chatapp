// src/app/chat/[receiverid]/page.js
"use client";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import io from "socket.io-client";
import Image from "next/image";
import { toast } from 'react-hot-toast';
import encryptionManager from '../../../utils/encryption';


const ChatPage = () => {
  const { receiverId } = useParams();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTimeout, setUploadTimeout] = useState(null);
  const [receiverName, setReceiverName] = useState("");
  const [chatId, setChatId] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [messageType, setMessageType] = useState("TEXT");
  const [chatKey, setChatKey] = useState(null);
  const fileInputRef = useRef(null);
  const router = useRouter();
  const socket = useRef(null);
  const messagesEndRef = useRef(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [editFile, setEditFile] = useState(null);
  const [editMessageType, setEditMessageType] = useState("TEXT");
  const editFileInputRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    socket.current = io("http://localhost:4000", { withCredentials: true });

    if (!receiverId) return;

    fetchReceiverName();
    fetchChatId();
    fetchCurrentUser();
    fetchMessages();

    // ضمان إنشاء المفتاح عند تحميل الصفحة
    if (currentUserId && receiverId) {
      encryptionManager.ensureUserKey(currentUserId);
    }

    socket.current.on("connect", () => {
      console.log("Socket connected");
      if (currentUserId) {
        socket.current.emit("setUserId", currentUserId);
      }
    });

    socket.current.on("connect_error", (err) => {
      console.error("Socket connect_error:", err);
    });

    socket.current.on("connect_timeout", (timeout) => {
      console.error("Socket connect_timeout:", timeout);
    });

    socket.current.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    socket.current.on("reconnect_error", (err) => {
      console.error("Socket reconnect_error:", err);
    });

    socket.current.on("newMessage", (newMessage) => {
      if (newMessage.chatId === chatId) {
        setMessages((prevMessages) => [...prevMessages, newMessage]);
      }
    });

    socket.current.on("messageDeleted", ({ messageId }) => {
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
    });

    socket.current.on("messageEdited", (updatedMessage) => {
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === updatedMessage.id ? updatedMessage : msg
        )
      );
    });

    socket.current.on("chatCleared", ({ chatId }) => {
      if (chatId === chatId) {
        setMessages([]);
      }
    });

    return () => {
      if (socket.current) {
        socket.current.off("connect");
        socket.current.off("connect_error");
        socket.current.off("connect_timeout");
        socket.current.off("disconnect");
        socket.current.off("reconnect_error");
        socket.current.off("newMessage");
        socket.current.off("messageDeleted");
        socket.current.off("messageEdited");
        socket.current.off("chatCleared");
        socket.current.disconnect();
      }
    };
  }, [receiverId, chatId, currentUserId]);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get("http://localhost:4000/me", {
        withCredentials: true,
      });
      setCurrentUserName(response.data.name);
      setCurrentUserId(response.data.id);
      // توليد مفتاح المستخدم تلقائياً
      encryptionManager.ensureUserKey(response.data.id);
      // إذا كان لدينا chatId، أنشئ مفتاح المحادثة المشترك
      if (chatId && response.data.id) {
        const chatKey = encryptionManager.ensureChatKey(chatId, response.data.id, receiverId);
        setChatKey(chatKey);
      }
      if (socket.current && currentUserId !== response.data.id) {
        socket.current.emit("setUserId", response.data.id);
      }
    } catch (error) {
      console.error("❌ خطأ أثناء جلب بيانات المستخدم الحالي", error);
    }
  };

  const fetchReceiverName = async () => {
    try {
      const response = await axios.get(
        `http://localhost:4000/users/${receiverId}`
      );
      setReceiverName(response.data.name);
    } catch (error) {
      console.error("❌ خطأ أثناء جلب اسم المستخدم", error);
    }
  };

  const fetchChatId = async () => {
    try {
      const response = await axios.get(
        `http://localhost:4000/chat/${receiverId}`,
        {
          withCredentials: true,
        }
      );
      setChatId(response.data.chatId);
      // توليد مفتاح المحادثة المشترك تلقائياً
      if (currentUserId) {
        const chatKey = encryptionManager.ensureChatKey(response.data.chatId, currentUserId, receiverId);
        setChatKey(chatKey);
      }
    } catch (error) {
      console.error("❌ خطأ أثناء جلب chatId", error);
    }
  };

  const fetchMessages = async () => {
    if (!chatId) return;

    try {
      const response = await axios.get(
        `http://localhost:4000/messages/${chatId}`,
        {
          withCredentials: true,
        }
      );

      if (Array.isArray(response.data)) {
        setMessages(response.data);
      } else {
        console.error("الرسائل غير صحيحة");
      }
    } catch (error) {
      console.error("❌ خطأ أثناء جلب الرسائل", error);
      if (error.response?.status === 401) {
        router.push("/login");
      }
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [chatId, chatKey, currentUserId]);

  // ضمان إنشاء المفتاح عند تغيير chatId
  useEffect(() => {
    if (chatId && currentUserId && !chatKey) {
      const newChatKey = encryptionManager.ensureChatKey(chatId, currentUserId, receiverId);
      setChatKey(newChatKey);
    }
  }, [chatId, currentUserId, chatKey]);

  // ضمان إنشاء مفتاح المستخدم عند تغيير currentUserId
  useEffect(() => {
    if (currentUserId) {
      encryptionManager.ensureUserKey(currentUserId);
    }
  }, [currentUserId]);

  // ضمان إنشاء مفتاح المحادثة عند تغيير receiverId
  useEffect(() => {
    if (chatId && currentUserId && receiverId) {
      const newChatKey = encryptionManager.ensureChatKey(chatId, currentUserId, receiverId);
      setChatKey(newChatKey);
    }
  }, [chatId, currentUserId, receiverId]);

  const renderMessageContent = (msg) => {
    // First render audio if it exists
    const audioContent = msg.type === 'AUDIO' ? (
      <div className="w-64 mb-2">
        <audio
          src={msg.mediaUrl}
          controls
          className="w-full"
          preload="metadata"
        >
          <source src={msg.mediaUrl} type="audio/wav" />
          Your browser does not support the audio element.
        </audio>
      </div>
    ) : null;

    // Then render other content
    const otherContent = (() => {
      if (!msg.mediaUrl && !msg.content) return null;

      switch (msg.type) {
        case 'IMAGE':
          return (
            <div className="relative w-64 h-64">
              <img
                src={msg.mediaUrl}
                alt="Shared image"
                className="object-cover rounded w-full h-full"
                loading="lazy"
              />
            </div>
          );
        case 'VIDEO':
          return (
            <div className="w-64">
              <video
                src={msg.mediaUrl}
                controls
                className="w-full rounded"
                preload="metadata"
              >
                <source src={msg.mediaUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          );
        case 'DOCUMENT':
          const fileName = msg.mediaUrl.split('/').pop();
          const isDOCX = fileName.toLowerCase().endsWith('.docx');
          const isTXT = fileName.toLowerCase().endsWith('.txt');
          
          return (
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <div className="text-2xl">
                {isDOCX ? '📝' : isTXT ? '📄' : '📎'}
              </div>
              <div className="flex flex-col">
                <a
                  href={msg.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                  download={fileName}
                >
                  {fileName}
                </a>
                <span className="text-xs text-gray-500">
                  {isDOCX ? 'Word Document' : isTXT ? 'Text Document' : 'Document'}
                </span>
              </div>
            </div>
          );
        default:
          let displayContent = msg.content;
          return displayContent ? <p className="text-black">{displayContent}</p> : null;
      }
    })();

    return (
      <div>
        {audioContent}
        {otherContent}
      </div>
    );
  };

  const renderReplyPreview = (message) => {
    if (!message) return null;
    
    switch (message.type) {
      case 'IMAGE':
        return (
          <span className="flex items-center gap-2">
            <div className="relative w-16 h-16">
              <img
                src={message.mediaUrl}
                alt="Shared image"
                className="object-cover rounded w-full h-full"
                loading="lazy"
              />
            </div>
            {message.content && <span className="text-gray-600">{message.content}</span>}
          </span>
        );
      case 'VIDEO':
        return (
          <span className="flex items-center gap-2">
            <div className="w-32">
              <video
                src={message.mediaUrl}
                controls
                className="w-full h-24 object-cover rounded"
                preload="metadata"
              >
                <source src={message.mediaUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
            {message.content && <span className="text-gray-600">{message.content}</span>}
          </span>
        );
      case 'AUDIO':
        return (
          <span className="flex items-center gap-2">
            <div className="w-48">
              <audio
                src={message.mediaUrl}
                controls
                className="w-full"
                preload="metadata"
              >
                <source src={message.mediaUrl} type="audio/wav" />
                Your browser does not support the audio element.
              </audio>
            </div>
            {message.content && <span className="text-gray-600">{message.content}</span>}
          </span>
        );
      case 'DOCUMENT':
        const fileName = message.mediaUrl.split('/').pop();
        const isPDF = fileName.toLowerCase().endsWith('.pdf');
        const isDOCX = fileName.toLowerCase().endsWith('.docx');
        const isDOC = fileName.toLowerCase().endsWith('.doc');
        
        return (
          <span className="flex items-center gap-2">
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <div className="text-xl">
                {isPDF ? '📄' : (isDOCX || isDOC) ? '📝' : '📎'}
              </div>
              <span className="text-sm text-gray-600">
                {fileName}
              </span>
            </div>
            {message.content && <span className="text-gray-600">{message.content}</span>}
          </span>
        );
      default:
        let displayContent = message.content;
        return <span className="text-gray-600">{displayContent}</span>;
    }
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const audioFile = new File([audioBlob], 'voice-message.wav', { type: 'audio/wav' });
        setSelectedFile(audioFile);
        setMessageType('AUDIO');
        setAudioBlob(audioBlob);
      };

      mediaRecorder.start();
      setMediaRecorder(mediaRecorder);
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("حدث خطأ أثناء بدء التسجيل");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && !selectedFile) return;

    try {
      if (isEditing && editingMessage) {
        // Handle editing existing message
        const formData = new FormData();
        if (selectedFile) {
          formData.append('file', selectedFile);
          formData.append('type', messageType);
        }
        
        let contentToSend = newMessage.trim();
        if (contentToSend) {
          formData.append('content', contentToSend);
        }

        const response = await axios.patch(
          `http://localhost:4000/messages/${editingMessage.id}`,
          formData,
          {
            withCredentials: true,
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        // Update the message in the messages array
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === editingMessage.id ? response.data : msg
          )
        );
        
        // Reset editing state
        setEditingMessage(null);
        setNewMessage("");
        setSelectedFile(null);
        setMessageType("TEXT");
        setIsEditing(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        // Handle sending new message
        const formData = new FormData();
        if (selectedFile) {
          formData.append('file', selectedFile);
          formData.append('type', messageType);
        }
        
        let contentToSend = newMessage.trim();
        if (contentToSend) {
          formData.append('content', contentToSend);
        }
        
        if (replyTo) {
          formData.append('replyToId', replyTo.id);
        }
        formData.append('receiverId', receiverId);

        const response = await axios.post(
          `http://localhost:4000/messages`,
          formData,
          {
            withCredentials: true,
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        if (response.status === 201) {
          setNewMessage("");
          setSelectedFile(null);
          setAudioBlob(null);
          setMessageType("TEXT");
          setReplyTo(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          
          // إضافة الرسالة مع فك التشفير
          setMessages(prevMessages => [...prevMessages, response.data.data]);
        }
      }
    } catch (error) {
      console.error("❌ خطأ أثناء إرسال/تعديل الرسالة:", error);
      toast.error(error.response?.data?.error || "حدث خطأ أثناء إرسال/تعديل الرسالة");
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!confirm("هل أنت متأكد من حذف هذه الرسالة؟")) return;

    try {
      await axios.delete(`http://localhost:4000/messages/${messageId}`, {
        withCredentials: true
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error(error.response?.data?.error || "حدث خطأ أثناء حذف الرسالة");
    }
  };

  const handleEditMessage = async (message) => {
    setEditingMessage(message);
    setNewMessage(message.content || "");
    setSelectedFile(null);
    setMessageType(message.type || "TEXT");
    setIsEditing(true);
    
    // If the message has media, we need to fetch it
    if (message.mediaUrl) {
      try {
        const response = await fetch(message.mediaUrl);
        const blob = await response.blob();
        const file = new File([blob], message.mediaUrl.split('/').pop(), { type: blob.type });
        setSelectedFile(file);
        
        // Set the correct message type based on the media
        if (message.type === 'IMAGE') {
          setMessageType('IMAGE');
        } else if (message.type === 'VIDEO') {
          setMessageType('VIDEO');
        } else if (message.type === 'AUDIO') {
          setMessageType('AUDIO');
        }
      } catch (error) {
        console.error("Error fetching media for edit:", error);
        toast.error("حدث خطأ أثناء تحميل الملف للتحرير");
      }
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMessage) return;

    try {
      const formData = new FormData();
      if (editFile) {
        formData.append('file', editFile);
        formData.append('type', editMessageType);
      }
      if (editContent.trim()) {
        formData.append('content', editContent.trim());
      }

      await axios.patch(
        `http://localhost:4000/messages/${editingMessage.id}`,
        formData,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      setEditingMessage(null);
      setEditContent("");
      setEditFile(null);
      setEditMessageType("TEXT");
    } catch (error) {
      console.error("Error editing message:", error);
      toast.error(error.response?.data?.error || "حدث خطأ أثناء تعديل الرسالة");
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const maxSize = 70 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("حجم الملف كبير جداً. الحد الأقصى هو 70 ميجابايت");
      event.target.value = '';
      return;
    }

    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif',
      'video/mp4', 'video/webm',
      'audio/mpeg', 'audio/wav',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error("نوع الملف غير مدعوم. يرجى اختيار صورة أو فيديو أو ملف صوتي أو مستند .docx أو .txt");
      event.target.value = '';
      return;
    }

    try {
      if (file.type.startsWith('image/')) {
        setMessageType('IMAGE');
      } else if (file.type.startsWith('video/')) {
        setMessageType('VIDEO');
      } else if (file.type.startsWith('audio/')) {
        setMessageType('AUDIO');
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                 file.type === 'text/plain') {
        setMessageType('DOCUMENT');
      }

      setSelectedFile(file);
    } catch (error) {
      console.error("Error processing file:", error);
      toast.error("حدث خطأ أثناء معالجة الملف");
    }
  };

  const handleClearChat = async () => {
    if (!confirm("هل أنت متأكد من حذف جميع الرسائل في هذه المحادثة؟")) return;

    try {
      await axios.delete(`http://localhost:4000/chats/${chatId}/messages`, {
        withCredentials: true
      });
    } catch (error) {
      console.error("Error clearing chat:", error);
      toast.error(error.response?.data?.error || "حدث خطأ أثناء حذف الرسائل");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">محادثة مع: {receiverName || "المستخدم"}</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClearChat}
              className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm font-medium"
            >
              حذف المحادثة
            </button>
          </div>
        </div>

        <div className="h-[500px] overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[70%] rounded-lg p-3 ${
                msg.senderId === currentUserId ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                {msg.replyTo && (
                  <div className="bg-gray-200 p-2 rounded-md mb-2 text-sm">
                    <span className="text-xs text-gray-600 font-semibold block mb-1">ردًا على:</span>
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
                        {msg.replyTo.sender.name}:
                      </span>
                      <div className="flex-1 min-w-0">
                        {renderReplyPreview(msg.replyTo)}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <div className="flex-grow">
                    <p className="text-sm font-semibold text-gray-700">
                      {msg.senderId === currentUserId ? currentUserName : receiverName}
                    </p>
                    {renderMessageContent(msg)}
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {msg.senderId === currentUserId && (
                      <>
                        <button
                          onClick={() => handleEditMessage(msg)}
                          className="text-blue-500 text-xs hover:underline"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="text-red-500 text-xs hover:underline"
                        >
                          حذف
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setReplyTo({ ...msg, content: msg.content });
                      }}
                      className="text-blue-500 text-xs hover:underline"
                    >
                      رد
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="border-t p-4">
          {replyTo && (
            <div className="bg-gray-100 p-2 rounded-md mb-2">
              <span className="text-xs text-black font-semibold block mb-1">ردًا على:</span>
              <div className="flex items-start gap-2">
                <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
                  {replyTo.sender.name}:
                </span>
                <div className="flex-1 min-w-0">
                  {renderReplyPreview(replyTo)}
                </div>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="text-red-500 text-xs hover:underline mt-2"
              >
                إلغاء الرد
              </button>
            </div>
          )}
          
          {isEditing && (
            <div className="bg-blue-100 p-2 rounded-md mb-2">
              <span className="text-xs text-blue-700 font-semibold block mb-1">تعديل الرسالة</span>
              <button
                onClick={() => {
                  setEditingMessage(null);
                  setNewMessage("");
                  setSelectedFile(null);
                  setMessageType("TEXT");
                  setIsEditing(false);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-red-500 text-xs hover:underline"
              >
                إلغاء التعديل
              </button>
            </div>
          )}
          
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            />
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-2 rounded-lg ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-yellow-500 hover:bg-yellow-600 text-white'
              }`}
              title={isRecording ? "إيقاف التسجيل" : "تسجيل رسالة صوتية"}
            >
              {isRecording ? '⏹️' : '🎤'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (fileInputRef.current) {
                  fileInputRef.current.click();
                }
              }}
              className="bg-blue-500 p-2 rounded-lg hover:bg-blue-600 text-white"
              title="إرفاق صورة أو فيديو"
            >
              📎
            </button>
            {selectedFile && (
              <div className="flex items-center gap-2 text-sm text-black">
                {selectedFile.name}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setAudioBlob(null);
                    setMessageType("TEXT");
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            )}
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                isEditing 
                  ? "تعديل الرسالة..." 
                  : replyTo 
                    ? `رد على ${replyTo.sender.name}` 
                    : "اكتب رسالتك هنا"
              }
              className="flex-grow border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() && !selectedFile}
              className={`px-6 py-2 rounded-lg ${
                !newMessage.trim() && !selectedFile
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {isEditing ? 'حفظ' : 'إرسال'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;