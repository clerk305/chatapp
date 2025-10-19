"use client";

import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useRouter, useParams } from 'next/navigation';
import io from 'socket.io-client';

const GroupView = () => {
  const [group, setGroup] = useState(null);
  const [username, setUsername] = useState(null);
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");
  const [newMemberId, setNewMemberId] = useState("");
  const [memberToDeleteId, setMemberToDeleteId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [messageType, setMessageType] = useState("TEXT");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showRemoveMember, setShowRemoveMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const socket = useRef(null);
  const router = useRouter();
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [editFile, setEditFile] = useState(null);
  const [editMessageType, setEditMessageType] = useState("TEXT");
  const editFileInputRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);

  const params = useParams();
  const groupid = params.groupid;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    socket.current = io("http://localhost:4000", { withCredentials: true });

    // Join the group room
    socket.current.emit("joinGroup", groupid);

    socket.current.on("newGroupMessage", (newMessage) => {
      console.log("Received new message:", newMessage);
      if (newMessage.groupId === groupid) {
        setMessages((prevMessages) => {
          const messageExists = prevMessages.some(msg => msg.id === newMessage.id);
          if (messageExists) {
            return prevMessages;
          }
          return [...prevMessages, newMessage];
        });
        scrollToBottom();
      }
    });

    // Add new socket event listeners
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

    socket.current.on("groupCleared", ({ groupId }) => {
      if (groupId === groupid) {
        setMessages([]);
      }
    });

    socket.current.on("groupDeleted", ({ groupId }) => {
      if (groupId === groupid) {
        router.push("/");
      }
    });

    socket.current.on("groupUpdated", ({ groupId }) => {
      if (groupId === groupid) {
        fetchGroup();
      }
    });

    return () => {
      if (socket.current) {
        socket.current.emit("leaveGroup", groupid);
        socket.current.off("newGroupMessage");
        socket.current.off("messageDeleted");
        socket.current.off("messageEdited");
        socket.current.off("groupCleared");
        socket.current.off("groupDeleted");
        socket.current.off("groupUpdated");
        socket.current.disconnect();
      }
    };
  }, [groupid]);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const response = await axios.get("http://localhost:4000/me", {
          withCredentials: true,
        });
        setUsername(response.data);
      } catch (error) {
        console.error("❌ خطأ في جلب بيانات المستخدم:", error);
      }
    };

    fetchUserDetails();
  }, []);

  const fetchGroup = async () => {
    if (!username) return;

    try {
      const res = await axios.get(`http://localhost:4000/groups/${groupid}`, {
        withCredentials: true,
      });

      if (res.data && res.data.group) {
        setGroup(res.data.group);
        setMessages(res.data.messages || []);

        const isCurrentUserAdmin = res.data.group.members.some(
          (member) => member.userId === username.id && member.isAdmin
        );
        setIsAdmin(isCurrentUserAdmin);
      }
    } catch (error) {
      console.error("Error fetching group:", error);
      alert("Failed to load group data. Please try refreshing the page.");
    }
  };

  useEffect(() => {
    fetchGroup();
  }, [groupid, username]);

  const fetchAvailableUsers = async () => {
    try {
      const response = await axios.get(`http://localhost:4000/users`, {
        withCredentials: true
      });
      
      const nonMembers = response.data.filter(user => 
        !group?.members.some(member => member.userId === user.id)
      );
      setSearchResults(nonMembers);
    } catch (error) {
      console.error("Error fetching users:", error);
      setSearchResults([]);
    }
  };

  useEffect(() => {
    if (showAddMember) {
      fetchAvailableUsers();
    } else {
      setSearchResults([]);
    }
  }, [showAddMember, group?.members]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        setSelectedFile(new File([audioBlob], 'voice-message.wav', { type: 'audio/wav' }));
        setMessageType('AUDIO');
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please ensure microphone permissions are granted.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const addMember = async (user) => {
    if (!user) {
      alert("Please select a user to add");
      return;
    }

    try {
      const response = await axios.post(
        `http://localhost:4000/groups/${groupid}/members`,
        { userId: user.id },
        { withCredentials: true }
      );

      if (response.status === 201) {
        await fetchGroup();
        setShowAddMember(false);
        setSelectedUser(null);
        setSearchQuery("");
        setSearchResults([]);
        alert("Member added successfully");
      }
    } catch (error) {
      console.error("Error adding member:", error);
      const errorMessage = error.response?.data?.error || "Failed to add member";
      const details = error.response?.data?.details;
      
      if (error.response?.status === 400 && error.response?.data?.member) {
        alert(`${errorMessage}: ${error.response.data.member.name} (${error.response.data.member.email})`);
      } else {
        alert(details ? `${errorMessage}: ${details}` : errorMessage);
      }
    }
  };

  const removeMember = async (memberId) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    
    try {
      const response = await axios.delete(
        `http://localhost:4000/groups/${groupid}/members/${memberId}`,
        {
          withCredentials: true
        }
      );
      
      if (response.status === 200) {
        await fetchGroup();
        setShowRemoveMember(false);
        alert("Member removed successfully");
      }
    } catch (error) {
      console.error("Error removing member:", error);
      const errorMessage = error.response?.data?.error || "Failed to remove member. Please try again.";
      alert(errorMessage);
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const maxSize = 70 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("حجم الملف كبير جداً. الحد الأقصى هو 70 ميجابايت");
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
      alert("نوع الملف غير مدعوم. يرجى اختيار صورة أو فيديو أو ملف صوتي أو مستند .docx أو .txt");
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
      alert("حدث خطأ أثناء معالجة الملف");
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!content.trim() && !selectedFile && !audioBlob) return;

    try {
      if (isEditing && editingMessage) {
        // Handle editing existing message
        const formData = new FormData();
        if (selectedFile) {
          formData.append('file', selectedFile);
          formData.append('type', messageType);
        }
        if (content.trim()) {
          formData.append('content', content.trim());
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
        setContent("");
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
        if (content.trim()) {
          formData.append('content', content.trim());
        }
        if (replyingTo) {
          formData.append('replyToId', replyingTo.id);
        }

        const response = await axios.post(
          `http://localhost:4000/groups/${groupid}/messages`,
          formData,
          {
            withCredentials: true,
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        if (response.status === 201) {
          // فقط امسح الحقول ولا تضف الرسالة يدويًا
          setContent('');
          setSelectedFile(null);
          setAudioBlob(null);
          setMessageType('TEXT');
          setReplyingTo(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          // لا تضف الرسالة إلى setMessages هنا!
          // الرسالة ستصل تلقائيًا من السوكيت
          scrollToBottom();
        }
      }
    } catch (error) {
      console.error('Error sending/editing message:', error);
      alert(error.response?.data?.error || 'Failed to send/edit message');
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
      alert(error.response?.data?.error || "حدث خطأ أثناء حذف الرسالة");
    }
  };

  const handleEditMessage = async (message) => {
    setEditingMessage(message);
    setEditContent(message.content || "");
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
        alert("حدث خطأ أثناء تحميل الملف للتحرير");
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
      if (selectedFile) {
        formData.append('file', selectedFile);
        formData.append('type', messageType);
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
      setSelectedFile(null);
      setMessageType("TEXT");
      setIsEditing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error("Error editing message:", error);
      alert(error.response?.data?.error || "حدث خطأ أثناء تعديل الرسالة");
    }
  };

  const handleClearGroupMessages = async () => {
    if (!confirm("هل أنت متأكد من حذف جميع الرسائل في هذه المجموعة؟")) return;

    try {
      await axios.delete(`http://localhost:4000/groups/${groupid}/messages`, {
        withCredentials: true
      });
    } catch (error) {
      console.error("Error clearing group messages:", error);
      alert(error.response?.data?.error || "حدث خطأ أثناء حذف الرسائل");
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm("هل أنت متأكد من حذف هذه المجموعة؟ هذا الإجراء لا يمكن التراجع عنه.")) return;

    try {
      await axios.delete(`http://localhost:4000/groups/${groupid}`, {
        withCredentials: true
      });
      router.push("/");
    } catch (error) {
      console.error("Error deleting group:", error);
      alert(error.response?.data?.error || "حدث خطأ أثناء حذف المجموعة");
    }
  };

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
          return msg.content ? <p className="text-black">{msg.content}</p> : null;
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

    const renderMediaPreview = () => {
      switch (message.type) {
        case 'IMAGE':
          return (
            <div className="relative w-16 h-16 flex-shrink-0">
              <img
                src={message.mediaUrl}
                alt="معاينة الصورة"
                className="object-cover rounded w-full h-full"
                loading="lazy"
              />
            </div>
          );
        case 'VIDEO':
          return (
            <div className="w-32 flex-shrink-0">
              <video
                src={message.mediaUrl}
                controls
                className="w-full h-24 object-cover rounded"
                preload="metadata"
              >
                <source src={message.mediaUrl} type="video/mp4" />
                متصفحك لا يدعم تشغيل الفيديو
              </video>
            </div>
          );
        case 'AUDIO':
          return (
            <div className="w-48 flex-shrink-0">
              <audio
                src={message.mediaUrl}
                controls
                className="w-full"
                preload="metadata"
              >
                <source src={message.mediaUrl} type="audio/wav" />
                متصفحك لا يدعم تشغيل الصوت
              </audio>
            </div>
          );
        case 'DOCUMENT':
          return (
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <div className="text-xl">
                {message.mediaUrl.endsWith('.pdf') ? '📄' : '📝'}
              </div>
              <span className="text-sm text-gray-600">
                {message.mediaUrl.split('/').pop()}
              </span>
            </div>
          );
        default:
          return null;
      }
    };

    const renderContent = () => {
      if (!message.content && !message.mediaUrl) return null;
      
      return (
        <div className="flex items-center gap-2 min-w-0">
          {message.mediaUrl && renderMediaPreview()}
          {message.content && (
            <span className="text-gray-600 text-sm line-clamp-2 flex-1">
              {message.content}
            </span>
          )}
        </div>
      );
    };

    return (
      <div className="w-full">
        {renderContent()}
      </div>
    );
  };

  const renderReplyPreviewContainer = () => {
    if (!replyingTo) return null;

    const getReplyTypeText = () => {
      switch (replyingTo.type) {
        case 'IMAGE':
          return 'صورة';
        case 'VIDEO':
          return 'فيديو';
        case 'AUDIO':
          return 'رسالة صوتية';
        default:
          return 'رسالة';
      }
    };

    return (
      <div className="bg-gray-100 p-2 rounded-md mb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs text-gray-600 font-semibold">ردًا على:</span>
              <span className="text-xs text-gray-600 font-medium">
                {replyingTo.sender.name}
              </span>
              <span className="text-xs text-gray-500">
                ({getReplyTypeText()})
              </span>
            </div>
            <div className="flex-1 min-w-0">
              {renderReplyPreview(replyingTo)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="text-red-500 text-xs hover:underline mt-1 flex-shrink-0"
          >
            إلغاء الرد
          </button>
        </div>
      </div>
    );
  };

  const renderMessageReply = (replyTo) => {
    if (!replyTo) return null;

    const getReplyTypeText = () => {
      switch (replyTo.type) {
        case 'IMAGE':
          return 'صورة';
        case 'VIDEO':
          return 'فيديو';
        case 'AUDIO':
          return 'رسالة صوتية';
        default:
          return 'رسالة';
      }
    };

    return (
      <div className="bg-gray-200 p-2 rounded-md mb-2 text-sm">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-xs text-gray-600 font-semibold">ردًا على:</span>
          <span className="text-xs text-gray-600 font-medium">
            {replyTo.sender.name}
          </span>
          <span className="text-xs text-gray-500">
            ({getReplyTypeText()})
          </span>
        </div>
        <div className="flex-1 min-w-0">
          {renderReplyPreview(replyTo)}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">مجموعة: {group?.name}</h1>
          </div>
          <div className="flex gap-3">
            {isAdmin && (
              <>
                <button
                  onClick={handleClearGroupMessages}
                  className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  حذف جميع الرسائل
                </button>
                <button
                  onClick={handleDeleteGroup}
                  className="bg-red-700 hover:bg-red-800 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  حذف المجموعة
                </button>
              </>
            )}
            {isAdmin && (
              <>
                <button
                  onClick={() => {
                    setShowAddMember(true);
                    setSearchResults([]);
                  }}
                  className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  إضافة عضو
                </button>
                <button
                  onClick={() => setShowRemoveMember(true)}
                  className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  حذف عضو
                </button>
              </>
            )}
          </div>
        </div>

        {showAddMember && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-black">إضافة عضو جديد</h2>
                <button
                  onClick={() => {
                    setShowAddMember(false);
                    setSearchResults([]);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-xl font-bold"
                >
                  ×
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto mb-4">
                {searchResults.length > 0 ? (
                  searchResults.map(user => (
                    <div
                      key={user.id}
                      className="p-3 hover:bg-gray-100 rounded flex items-center justify-between border-b transition-colors duration-200"
                    >
                      <div>
                        <p className="font-medium text-black">{user.name}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                      <button
                        onClick={() => addMember(user)}
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 shadow-sm"
                      >
                        إضافة
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-2">لا يوجد مستخدمين متاحين للإضافة</p>
                    <p className="text-sm text-gray-400">جميع المستخدمين هم أعضاء بالفعل في المجموعة</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end border-t pt-4">
                <button
                  onClick={() => {
                    setShowAddMember(false);
                    setSearchResults([]);
                  }}
                  className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-black font-medium transition-colors duration-200 shadow-sm"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}

        {showRemoveMember && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-black">حذف عضو من المجموعة</h2>
                <button
                  onClick={() => setShowRemoveMember(false)}
                  className="text-gray-500 hover:text-gray-700 text-xl font-bold"
                >
                  ×
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto mb-4">
                {group?.members && group.members.length > 0 ? (
                  group.members.map(member => (
                    <div 
                      key={member.id} 
                      className="p-3 hover:bg-gray-100 rounded flex items-center justify-between border-b transition-colors duration-200"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-black text-lg">
                          {member.user?.name || 'Unknown User'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {member.user?.email || 'No email available'}
                        </p>
                        {member.isAdmin && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Admin</span>
                        )}
                      </div>
                      {member.userId !== username?.id && !member.isAdmin && (
                        <button
                          onClick={() => removeMember(member.userId)}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 shadow-sm"
                        >
                          حذف
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">لا يوجد أعضاء في المجموعة</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end border-t pt-4">
                <button
                  onClick={() => setShowRemoveMember(false)}
                  className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-black font-medium transition-colors duration-200 shadow-sm"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="h-[500px] overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={`${msg.id}-${idx}`}
              className={`flex ${msg.senderId === username?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[70%] rounded-lg p-3 ${
                msg.senderId === username?.id ? 'bg-blue-100' : 'bg-gray-100'
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
                    <span className="text-sm font-semibold text-gray-700 block">
                      {msg.sender.name}
                    </span>
                    {msg.content ? <p className="text-black">{msg.content}</p> : null}
                    <span className="text-xs text-gray-500 mt-1 block">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {msg.senderId === username?.id && (
                      <button
                        onClick={() => handleEditMessage(msg)}
                        className="text-blue-500 text-xs hover:underline"
                      >
                        تعديل
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="text-red-500 text-xs hover:underline"
                    >
                      حذف
                    </button>
                    <button
                      onClick={() => setReplyingTo(msg)}
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
          {renderReplyPreviewContainer()}
          
          {isEditing && (
            <div className="bg-blue-100 p-2 rounded-md mb-2">
              <span className="text-xs text-blue-700 font-semibold block mb-1">تعديل الرسالة</span>
              <button
                onClick={() => {
                  setEditingMessage(null);
                  setContent("");
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
              accept="image/*,video/*,audio/*"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-gray-200 p-2 rounded-lg hover:bg-gray-300"
              title="Attach file"
            >
              📎
            </button>
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-2 rounded-lg ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
              title={isRecording ? "Stop Recording" : "Record Voice Message"}
            >
              {isRecording ? '⏹️' : '🎤'}
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
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                isEditing 
                  ? "تعديل الرسالة..." 
                  : replyingTo 
                    ? `رد على ${replyingTo.sender.name}` 
                    : "اكتب رسالتك هنا"
              }
              className="flex-grow border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 text-black"
            />
            <button
              type="submit"
              disabled={!content.trim() && !selectedFile && !audioBlob}
              className={`px-6 py-2 rounded-lg ${
                !content.trim() && !selectedFile && !audioBlob
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

export default GroupView;