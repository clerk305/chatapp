//npx prisma studio
//npx prisma migrate deploy
//npx prisma generate
//npx prisma migrate
//npx prisma migrate reset
//npx prisma migrate dev --name init

//npm cache clean --force
//npx prisma format
//1 npm init -y
//2 npm install prisma --save-dev
//3 npm install @prisma/client
//4 npm install express  bcryptjs cors dotenv socket.io  cookie-parser jsonwebtoken
//5 npx prisma init
 


const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');
require("dotenv").config();
const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 4000;
const SECRET_KEY = process.env.JWT_SECRET || "your_secret_key";
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});
const CryptoJS = require('crypto-js');
const MESSAGE_SECRET_KEY = process.env.MESSAGE_SECRET_KEY || 'your_super_secret_key';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 120000,
  chunk_size: 6000000,
  secure: true,
  private_cdn: false
});

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    console.log("Auth middleware - Token from cookie:", token);

    if (!token) {
      console.log("Auth middleware - No token found");
      return res.status(401).json({ error: "غير مصرح" });
    }

    const decoded = jwt.verify(token, SECRET_KEY);
    console.log("Auth middleware - Decoded token:", decoded);
    
    req.userId = decoded.userId;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    if (error.name === "JsonWebTokenError") {
      return res.status(403).json({ error: "رمز غير صالح" });
    }
    res.status(500).json({ error: "خطأ في المصادقة" });
  }
};

io.on("connection", (socket) => {
  console.log(`⚡️ User connected: ${socket.id}`);

  socket.on("setUserId", (userId) => {
    if (!userId) {
      console.error("Invalid userId received:", userId);
      return;
    }
    const roomId = `user-${userId}`;
    socket.join(roomId);
    console.log(`👤 User ${userId} joined room ${roomId}`);
  });

  socket.on("joinGroup", (groupId) => {
    if (!groupId) {
      console.error("Invalid groupId received:", groupId);
      return;
    }
    const roomId = `group-${groupId}`;
    socket.join(roomId);
    console.log(`👥 Socket ${socket.id} joined group room ${roomId}`);
  });

  socket.on("leaveGroup", (groupId) => {
    if (!groupId) {
      console.error("Invalid groupId received:", groupId);
      return;
    }
    const roomId = `group-${groupId}`;
    socket.leave(roomId);
    console.log(`👥 Socket ${socket.id} left group room ${roomId}`);
  });

  socket.on("disconnect", () => {
    console.log(`🔥 User disconnected: ${socket.id}`);
  });

  // Remove all call-related socket events
});

// ✅ **إنشاء حساب**
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    res.status(201).json({ message: "تم إنشاء الحساب بنجاح" });
  } catch (error) {
    res.status(500).json({ error: "حدث خطأ أثناء إنشاء الحساب" });
  }
});
app.get("/me", authMiddleware, async (req, res) => {
  try {
    console.log("Token from cookie:", req.cookies.token);
    console.log("User ID from token:", req.userId);
    
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true },
    });

    if (!user) {
      console.log("User not found for ID:", req.userId);
      return res.status(404).json({ error: "المستخدم غير موجود" });
    }

    console.log("Found user:", user);
    res.json(user);
  } catch (error) {
    console.error("Error in /me endpoint:", error);
    res.status(500).json({ error: "حدث خطأ أثناء جلب بيانات المستخدم" });
  }
});
app.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false, // اجعله true في الإنتاج
    sameSite: "strict",
  });
  res.json({ message: "تم تسجيل الخروج بنجاح" });
});

// ✅ **تسجيل الدخول**
app.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) return res.status(401).json({ error: "البريد الإلكتروني غير صحيح" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: "كلمة المرور غير صحيحة" });

    const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: "7d" });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // غيّر إلى `true` عند استخدام HTTPS
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 أيام
    });

    res.json({ message: "تم تسجيل الدخول بنجاح" });
  } catch (error) {
    res.status(500).json({ error: "حدث خطأ أثناء تسجيل الدخول" });
  }
});

// Add search users endpoint
app.get("/search/users", authMiddleware, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.json([]);
    }

    const searchQuery = query.trim().toLowerCase();

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { NOT: { id: req.userId } }, // Exclude current user
          {
            OR: [
              { name: { contains: searchQuery, mode: 'insensitive' } },
              { email: { contains: searchQuery, mode: 'insensitive' } }
            ]
          }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true
      },
      orderBy: [
        { name: 'asc' }
      ],
      take: 10 // Limit results to 10 users
    });

    console.log(`Search results for "${searchQuery}":`, {
      count: users.length,
      users: users.map(u => ({ id: u.id, name: u.name, email: u.email }))
    });

    res.json(users);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ 
      error: "Error searching users",
      details: error.message 
    });
  }
});

// Search groups
app.get("/search/groups", authMiddleware, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const groups = await prisma.group.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' }
      },
      include: {
        members: {
          select: {
            userId: true,
            isAdmin: true
          }
        }
      }
    });

    // Add isMember flag to each group
    const groupsWithMembership = groups.map(group => ({
      ...group,
      isMember: group.members.some(member => member.userId === req.userId)
    }));

    res.json(groupsWithMembership);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Error searching groups" });
  }
});

// Updated uploadToCloudinary function
const uploadToCloudinary = (buffer, folder, resourceType = "raw", format = null) => {
  return new Promise((resolve, reject) => {
    // Configure upload options based on resource type
    const uploadOptions = {
      folder: folder,
      resource_type: resourceType,
      chunk_size: 6000000,
      timeout: 120000,
      invalidate: true,
      unique_filename: true,
      access_mode: 'public',
      type: 'upload'
    };

    if (format) {
      uploadOptions.format = format;
    }

    // Add specific options based on resource type
    switch (resourceType) {
      case "image":
        uploadOptions.quality = "auto";
        uploadOptions.fetch_format = "auto";
        if (buffer.toString('hex', 0, 8).includes('89504e47')) {
          uploadOptions.format = "png";
          uploadOptions.quality = "auto:good";
          uploadOptions.eager = [
            { format: "png", quality: "auto:good" },
            { format: "webp", quality: "auto:good" }
          ];
        } else {
          uploadOptions.eager = [
            { format: "webp", quality: "auto" }
          ];
        }
        break;
      case "video":
        uploadOptions.format = "mp4";
        uploadOptions.video_codec = "h264";
        uploadOptions.bit_rate = "2000k";
        uploadOptions.audio_codec = "aac";
        uploadOptions.eager = [{
          format: "mp4",
          quality: "auto",
          video_codec: "h264",
          bit_rate: "2000k"
        }];
        break;
      case "audio":
        uploadOptions.resource_type = "raw";
        uploadOptions.format = "mp3";
        uploadOptions.audio_codec = "aac";
        uploadOptions.bit_rate = "128k";
        break;
      case "raw":
        // For documents, we allow all document types
        uploadOptions.resource_type = 'raw';
        if (format) {
          uploadOptions.format = format;
        }
        break;
    }

    console.log("Starting Cloudinary upload with options:", {
      resourceType,
      format,
      size: buffer.length,
      folder,
      options: uploadOptions
    });

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error details:", {
            message: error.message,
            http_code: error.http_code,
            name: error.name,
            resourceType,
            format,
            size: buffer.length
          });
          
          if (error.http_code === 499) {
            reject(new Error("Upload timed out. Please try again with a smaller file or better connection."));
          } else if (error.http_code === 413) {
            reject(new Error("File too large. Maximum size is 100MB."));
          } else if (error.http_code === 404) {
            reject(new Error("Upload failed: Invalid resource type or format. Please try a different file format."));
          } else {
            reject(new Error(`Upload failed: ${error.message}`));
          }
        } else {
          console.log("Cloudinary upload success:", {
            url: result.secure_url,
            type: result.resource_type,
            format: result.format,
            size: result.bytes
          });
          resolve(result);
        }
      }
    );

    const readStream = streamifier.createReadStream(buffer);
    
    readStream.on('error', (error) => {
      console.error("Stream error:", error);
      reject(new Error("Error reading file stream"));
    });

    readStream.pipe(uploadStream);
  });
};

// Function to process media file with FFmpeg
const processMediaFile = async (buffer, type, originalSize) => {
  // For images, return the original buffer without FFmpeg processing
  if (type === 'IMAGE') {
    console.log(`Processing image:`, {
      originalSize: `${(originalSize / 1024 / 1024).toFixed(2)}MB`
    });
    
    // For images, we'll use sharp for processing instead of FFmpeg
    try {
      const sharp = require('sharp');
      const processedBuffer = await sharp(buffer)
        .resize(1280, 720, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .png({ quality: 85 })
        .toBuffer();
      
      const processedSize = processedBuffer.length;
      console.log(`Image processed successfully:`, {
        originalSize: `${(originalSize / 1024 / 1024).toFixed(2)}MB`,
        processedSize: `${(processedSize / 1024 / 1024).toFixed(2)}MB`,
        reduction: `${((originalSize - processedSize) / originalSize * 100).toFixed(2)}%`
      });

      return processedBuffer;
    } catch (error) {
      console.error('Error processing image with sharp:', error);
      // If sharp processing fails, return original buffer
    return buffer;
    }
  }

  // For PDF and Word files, we'll use a different compression approach
  if (type === 'DOCUMENT') {
    try {
      // For PDF files, we can use ghostscript for compression
      if (buffer.toString('hex', 0, 4) === '25504446') { // PDF magic number
        const gs = require('ghostscript4js');
        const tempDir = os.tmpdir();
        const inputPath = path.join(tempDir, `input-${Date.now()}.pdf`);
        const outputPath = path.join(tempDir, `output-${Date.now()}.pdf`);
        
        fs.writeFileSync(inputPath, buffer);
        
        await gs.execute(
          `-sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile=${outputPath} ${inputPath}`
        );
        
        const processedBuffer = fs.readFileSync(outputPath);
        
        // Clean up temporary files
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        
        return processedBuffer;
      }
      
      // For Word files, we'll use a different approach
      // Note: This is a placeholder. You'll need to implement actual Word compression
      return buffer;
    } catch (error) {
      console.error('Error processing document:', error);
      return buffer;
    }
  }

  return new Promise((resolve, reject) => {
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `input-${Date.now()}`);
    const outputPath = path.join(tempDir, `output-${Date.now()}`);

    // Write buffer to temporary file
    fs.writeFileSync(inputPath, buffer);

    console.log(`Processing ${type} file:`, {
      originalSize: `${(originalSize / 1024 / 1024).toFixed(2)}MB`
    });

    let command = ffmpeg(inputPath);

    // Configure FFmpeg based on file type
    switch (type) {
      case 'VIDEO':
        command = command
          .outputOptions([
            '-c:v libx264', // H.264 codec
            '-preset veryfast', // Very fast encoding
            '-crf 28', // Higher CRF for better compression
            '-maxrate 1000k', // Maximum bitrate in kbps
            '-bufsize 2000k', // Buffer size in kbps
            '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2', // Ensure even dimensions
            '-pix_fmt yuv420p', // Pixel format for better compatibility
            '-movflags +faststart', // Enable fast start for web playback
            '-c:a aac', // Audio codec
            '-b:a 96k', // Audio bitrate
            '-ar 44100', // Audio sample rate
            '-ac 2', // Audio channels
            '-metadata service_provider=""', // Remove metadata
            '-metadata service_name=""',
            '-metadata title=""',
            '-metadata artist=""',
            '-metadata album=""',
            '-metadata date=""',
            '-metadata copyright=""'
          ])
          .format('mp4')
          .on('start', (commandLine) => {
            console.log('FFmpeg started with command:', commandLine);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log('Processing: ' + Math.floor(progress.percent) + '% done');
            }
          })
          .on('error', (err, stdout, stderr) => {
            console.error('FFmpeg error details:', {
              error: err.message,
              stdout: stdout,
              stderr: stderr
            });
          });
        break;

      case 'AUDIO':
        command = command
          .outputOptions([
            '-c:a libmp3lame', // MP3 codec
            '-q:a 4', // Audio quality (0-9, higher = more compression)
            '-ar 44100', // Sample rate
            '-metadata service_provider=""', // Remove metadata
            '-metadata service_name=""',
            '-metadata title=""',
            '-metadata artist=""',
            '-metadata album=""',
            '-metadata date=""',
            '-metadata copyright=""'
          ])
          .format('mp3');
        break;

      default:
        return resolve(buffer); // Return original buffer if type not supported
    }

    command
      .on('end', () => {
        try {
          const processedBuffer = fs.readFileSync(outputPath);
          const processedSize = processedBuffer.length;
          
          console.log(`File processed successfully:`, {
            type,
            originalSize: `${(originalSize / 1024 / 1024).toFixed(2)}MB`,
            processedSize: `${(processedSize / 1024 / 1024).toFixed(2)}MB`,
            reduction: `${((originalSize - processedSize) / originalSize * 100).toFixed(2)}%`
          });

          // Clean up temporary files
          fs.unlinkSync(inputPath);
          fs.unlinkSync(outputPath);

          resolve(processedBuffer);
        } catch (error) {
          console.error('Error reading processed file:', error);
          // Clean up temporary files
          try {
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
          } catch (e) {
            // Ignore cleanup errors
          }
          reject(error);
        }
      })
      .on('error', (err) => {
        console.error('Error processing file:', err);
        // Clean up temporary files
        try {
          fs.unlinkSync(inputPath);
          fs.unlinkSync(outputPath);
        } catch (e) {
          // Ignore cleanup errors
        }
        reject(err);
      })
      .save(outputPath);
  });
};

function encryptText(text) {
  return CryptoJS.AES.encrypt(text, MESSAGE_SECRET_KEY).toString();
}
function decryptText(cipher) {
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, MESSAGE_SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return cipher;
  }
}

// Updated message endpoint to handle file upload using multer
app.post("/messages", authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { receiverId, content, type = "TEXT", replyToId, chatId, isEncrypted } = req.body;
    const senderId = req.userId;
    let mediaUrl = null;

    // Validate required fields
    if (!receiverId) {
      return res.status(400).json({ error: "Receiver ID is required" });
    }

    // Handle file upload if present
    if (req.file) {
      // Check file size (100MB limit)
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes
      if (req.file.size > MAX_FILE_SIZE) {
        return res.status(400).json({ 
          error: "File too large. Maximum size is 100MB." 
        });
      }

      console.log("Processing file upload:", {
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        type: type
      });

      try {
        // Process file with FFmpeg if it's media
        let processedBuffer = req.file.buffer;
        if (type !== "TEXT" && type !== "DOCUMENT") {
          processedBuffer = await processMediaFile(req.file.buffer, type, req.file.size);
        }

        // Determine resource type and format based on content type
        let resourceType = "raw";
        let format = null;

        if (type === "IMAGE" || req.file.mimetype.startsWith('image/')) {
          resourceType = "image";
          format = "auto";
        } else if (type === "VIDEO" || req.file.mimetype.startsWith('video/')) {
          resourceType = "video";
          format = "mp4";
        } else if (type === "AUDIO" || req.file.mimetype.startsWith('audio/')) {
          resourceType = "raw";
          format = "mp3";
        } else if (type === "DOCUMENT") {
          resourceType = "raw";
          // Set format based on file extension
          const ext = req.file.originalname.split('.').pop().toLowerCase();
          format = ext;
        }

        const result = await uploadToCloudinary(processedBuffer, "chat-media", resourceType, format);
        mediaUrl = result.secure_url;
        console.log("File uploaded successfully to Cloudinary:", {
          url: mediaUrl,
          type: resourceType,
          format: format,
          size: processedBuffer.length
        });
      } catch (uploadError) {
        console.error("Error uploading to Cloudinary:", uploadError);
        return res.status(500).json({ 
          error: uploadError.message || "Failed to upload media file",
          details: uploadError
        });
      }
    }

    if (!content && !mediaUrl) {
      return res.status(400).json({ error: "Message content or media is required" });
    }

    // Find or create chat
    let chat;
    if (chatId) {
      chat = await prisma.privateChat.findUnique({
        where: { id: chatId }
      });
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }
    } else {
      chat = await prisma.privateChat.findFirst({
      where: {
        OR: [
          { user1Id: senderId, user2Id: receiverId },
          { user1Id: receiverId, user2Id: senderId },
        ],
      },
    });

    if (!chat) {
      chat = await prisma.privateChat.create({
        data: { user1Id: senderId, user2Id: receiverId },
      });
    }
    }

    // تشفير الرسالة قبل الحفظ
    const encryptedContent = content ? encryptText(content) : null;

    // Create message with encryption flag
    const message = await prisma.message.create({
      data: {
        senderId: senderId,
        content: encryptedContent,
        type: type,
        mediaUrl: mediaUrl,
        chatId: chat.id,
        replyToId: replyToId || null,
      },
      include: {
        sender: { select: { id: true, name: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: { select: { name: true } },
          },
        },
      },
    });

    // Add encryption flag to the response
    const messageWithEncryption = {
      ...message,
      isEncrypted: isEncrypted === 'true'
    };

    // Emit socket event (فك تشفير الرسالة قبل الإرسال)
    const decryptedMessage = {
      ...messageWithEncryption,
      content: messageWithEncryption.content ? decryptText(messageWithEncryption.content) : null
    };
    io.to(`user-${receiverId}`).emit("newMessage", decryptedMessage);
    
    // Send response (أيضًا فك التشفير هنا)
    res.status(201).json({ 
      message: "Message sent successfully", 
      data: decryptedMessage
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ 
      error: "Error sending message",
      details: error.message 
    });
  }
});

// Updated group message endpoint
app.post("/groups/:groupid/messages", authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { groupid } = req.params;
    const { content, type = "TEXT", replyToId, isEncrypted } = req.body;
    const userId = req.userId;
    let mediaUrl = null;

    // Check if user is a member of the group
    const isMember = await prisma.groupMember.findFirst({
      where: { 
        groupId: groupid, 
        userId: userId 
      }
    });

    if (!isMember) {
      return res.status(403).json({ error: "You are not a member of this group" });
    }

    // Handle media upload if present
    if (req.file) {
      try {
        // Process file with FFmpeg if it's media
        let processedBuffer = req.file.buffer;
        if (type !== "TEXT" && type !== "DOCUMENT") {
          processedBuffer = await processMediaFile(req.file.buffer, type, req.file.size);
        }

        // Determine resource type and format based on content type
        let resourceType = "raw";
        let format = null;

        if (type === "IMAGE" || req.file.mimetype.startsWith('image/')) {
          resourceType = "image";
          format = "auto";
        } else if (type === "VIDEO" || req.file.mimetype.startsWith('video/')) {
          resourceType = "video";
          format = "mp4";
        } else if (type === "AUDIO" || req.file.mimetype.startsWith('audio/')) {
          resourceType = "raw";
          format = "mp3";
        } else if (type === "DOCUMENT") {
          resourceType = "raw";
          // Set format based on file extension
          const ext = req.file.originalname.split('.').pop().toLowerCase();
          format = ext;
        }

        console.log("Processing file upload:", {
          filename: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          type: type,
          resourceType: resourceType,
          format: format
        });

        const result = await uploadToCloudinary(processedBuffer, "group-media", resourceType, format);
        mediaUrl = result.secure_url;
        console.log("File uploaded successfully to Cloudinary:", {
          url: mediaUrl,
          type: resourceType,
          format: format,
          size: processedBuffer.length
        });
      } catch (uploadError) {
        console.error("Error uploading media:", uploadError);
        return res.status(500).json({ 
          error: uploadError.message || "Failed to upload media",
          details: uploadError
        });
      }
    }

    // Validate that we have either content or media
    if (!content?.trim() && !mediaUrl) {
      return res.status(400).json({ error: "Message must have either content or media" });
    }

    // تشفير الرسالة قبل الحفظ
    const encryptedContent = content?.trim() ? encryptText(content.trim()) : null;

    const message = await prisma.message.create({
      data: {
        senderId: userId,
        content: encryptedContent,
        type: type,
        mediaUrl: mediaUrl,
        groupId: groupid,
        replyToId: replyToId || null,
      },
      include: {
        sender: { 
          select: { id: true, name: true } 
        },
        replyTo: {
          include: {
            sender: { select: { name: true } }
          }
        }
      }
    });

    // Add encryption flag to the response
    const messageWithEncryption = {
      ...message,
      isEncrypted: isEncrypted === 'true'
    };

    // فك تشفير الرسالة والرد قبل الإرسال
    const decryptedMessage = {
      ...messageWithEncryption,
      content: messageWithEncryption.content ? decryptText(messageWithEncryption.content) : null,
      groupId: groupid,
      replyTo: messageWithEncryption.replyTo ? {
        ...messageWithEncryption.replyTo,
        content: messageWithEncryption.replyTo.content ? decryptText(messageWithEncryption.replyTo.content) : null
      } : null
    };

    // Emit the message to all clients in the group room
    console.log("Emitting new message to group:", groupid);
    io.to(`group-${groupid}`).emit("newGroupMessage", decryptedMessage);

    res.status(201).json({ 
      message: "Message sent successfully", 
      data: decryptedMessage
    });
  } catch (error) {
    console.error("Error sending group message:", error);
    res.status(500).json({ error: "Error sending group message" });
  }
});

// Update the messages endpoint to correctly handle scalar fields
app.get("/messages/:chatId", authMiddleware, async (req, res) => {
  try {
    const { chatId } = req.params;

    const messages = await prisma.message.findMany({
      where: {
        chatId: chatId,
      },
      orderBy: { createdAt: "asc" },
      include: {
        sender: {
          select: { id: true, name: true },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            type: true,
            mediaUrl: true,
            sender: { 
              select: { name: true } 
            }
          },
        },
      },
    });

    // فك تشفير الرسائل والردود قبل الإرسال
    const messagesDecrypted = messages.map(msg => ({
      ...msg,
      content: msg.content ? decryptText(msg.content) : null,
      replyTo: msg.replyTo ? {
        ...msg.replyTo,
        content: msg.replyTo.content ? decryptText(msg.replyTo.content) : null
      } : null
    }));

    res.json(messagesDecrypted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ أثناء جلب الرسائل" });
  }
});

// مسار جديد للحصول على chatId بين المستخدمين
app.get("/chat/:receiverId", authMiddleware, async (req, res) => {
  try {
    const { receiverId } = req.params;

    let chat = await prisma.privateChat.findFirst({
      where: {
        OR: [
          { user1Id: req.userId, user2Id: receiverId },
          { user1Id: receiverId, user2Id: req.userId },
        ],
      },
    });

    if (!chat) {
      chat = await prisma.privateChat.create({
        data: {
          user1Id: req.userId,
          user2Id: receiverId,
        },
      });
    }

    res.json({ chatId: chat.id });
  } catch (error) {
    console.error("❌ خطأ أثناء جلب chatId:", error);
    res.status(500).json({ error: "حدث خطأ أثناء جلب chatId" });
  }
});

// Update the get all users endpoint
app.get("/users", authMiddleware, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        NOT: { id: req.userId } // Exclude current user
      },
      select: {
        id: true,
        name: true,
        email: true
      },
      orderBy: [
        { name: 'asc' } // Sort by name alphabetically
      ]
    });

    console.log(`Fetched ${users.length} users`);
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ 
      error: "Error fetching users",
      details: error.message 
    });
  }
});

app.get("/users/:id", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { name: true },
    });

    if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });

    res.json(user);
  } catch (error) {
    console.error("❌ خطأ أثناء جلب المستخدم:", error);
    res.status(500).json({ error: "❌ حدث خطأ أثناء جلب المستخدم" });
  }
});
// ✅ **إنشاء مجموعة جديدة**
app.post("/groups", authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    const creatorId = req.userId;

    const newGroup = await prisma.group.create({
      data: {
        name,
        creatorId,
        members: {
          create: { userId: creatorId, isAdmin: true },
        },
      },
    });

    res.status(201).json({ message: "تم إنشاء المجموعة بنجاح", group: newGroup });
  } catch (error) {
    res.status(500).json({ error: "حدث خطأ أثناء إنشاء المجموعة" });
  }
});
// ✅ جلب بيانات مجموعة ورسائلها
app.get("/groups/:groupid", authMiddleware, async (req, res) => {
  try {
    const { groupid } = req.params;

    const group = await prisma.group.findUnique({
      where: { id: groupid },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const messages = await prisma.message.findMany({
      where: { groupId: groupid },
      include: {
        sender: {
          select: { id: true, name: true }
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            type: true,
            mediaUrl: true,
            sender: { 
              select: { name: true } 
            }
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    // فك تشفير الرسائل والردود قبل الإرسال
    const messagesDecrypted = messages.map(msg => ({
      ...msg,
      content: msg.content ? decryptText(msg.content) : null,
      replyTo: msg.replyTo ? {
        ...msg.replyTo,
        content: msg.replyTo.content ? decryptText(msg.replyTo.content) : null
      } : null
    }));

    res.json({ group, messages: messagesDecrypted });
  } catch (error) {
    console.error("Error fetching group:", error);
    res.status(500).json({ error: "Error fetching group data" });
  }
});

// Update the add member endpoint
app.post("/groups/:groupid/members", authMiddleware, async (req, res) => {
  try {
    const { groupid } = req.params;
    const userId = req.userId; // Use the authenticated user's ID

    // First check if the group exists
    const group = await prisma.group.findUnique({
      where: { id: groupid },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if the user is already a member
    const existingMember = group.members.find(m => m.userId === userId);
    if (existingMember) {
      return res.status(400).json({ 
        error: "You are already a member of this group",
        member: {
          id: existingMember.id,
          name: existingMember.user.name,
          email: existingMember.user.email,
          isAdmin: existingMember.isAdmin
        }
      });
    }

    // Add the user as a member
    try {
      const newMember = await prisma.groupMember.create({
        data: {
          groupId: groupid,
          userId: userId,
          isAdmin: false
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // Emit socket event to notify all group members
      io.to(`group-${groupid}`).emit("groupUpdated", { 
        groupId: groupid,
        action: "memberAdded",
        member: {
          id: newMember.id,
          userId: newMember.userId,
          name: newMember.user.name,
          email: newMember.user.email,
          isAdmin: newMember.isAdmin
        }
      });

      res.status(201).json({ 
        message: "Successfully joined the group", 
        member: {
          id: newMember.id,
          userId: newMember.userId,
          name: newMember.user.name,
          email: newMember.user.email,
          isAdmin: newMember.isAdmin
        }
      });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(400).json({ 
          error: "You are already a member of this group",
          details: "This user is already a member, but the check failed. Please refresh the page."
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error joining group:", error);
    res.status(500).json({ 
      error: "Failed to join group",
      details: error.message
    });
  }
});

// ✅ **حذف عضو من مجموعة**
app.delete("/groups/:groupid/members/:memberId", authMiddleware, async (req, res) => {
    try {
      const { groupid, memberId } = req.params;
      const userId = req.userId;

      // Get the group with full member details
      const group = await prisma.group.findUnique({
        where: { id: groupid },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      });

      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      const memberToRemove = group.members.find(m => m.userId === memberId);
      if (!memberToRemove) {
        return res.status(404).json({ error: "Member not found in the group" });
      }

      // If the user is trying to remove themselves, redirect to the leave group endpoint
      if (memberToRemove.userId === userId) {
        // Get the group member record
        const groupMember = await prisma.groupMember.findFirst({
          where: {
            groupId: groupid,
            userId: userId
          }
        });

        if (!groupMember) {
          return res.status(404).json({ error: "You are not a member of this group" });
        }

        // Check if user is the last admin
        const adminCount = await prisma.groupMember.count({
          where: {
            groupId: groupid,
            isAdmin: true
          }
        });

        const isLastAdmin = groupMember.isAdmin && adminCount === 1;
        if (isLastAdmin) {
          return res.status(400).json({ 
            error: "Cannot leave the group. You are the last admin. Please assign another admin first." 
          });
        }

        // Remove the member
        await prisma.groupMember.delete({
          where: {
            id: groupMember.id
          }
        });

        // Emit socket event
        io.to(`group-${groupid}`).emit("groupUpdated", { 
          groupId: groupid,
          action: "memberLeft",
          userId: userId
        });

        return res.json({ message: "Successfully left the group" });
      }

      // If not removing self, check if the user is an admin
      const isAdmin = group.members.some(m => m.userId === userId && m.isAdmin);
      if (!isAdmin) {
        return res.status(403).json({ error: "You are not an admin of this group" });
      }

      // Remove the member
      await prisma.groupMember.delete({
        where: {
          id: memberToRemove.id
        }
      });

      io.to(`group-${groupid}`).emit("groupUpdated", { 
        groupId: groupid,
        action: "memberRemoved",
        userId: memberId
      });
      
      res.status(200).json({ message: "Member removed successfully" });
    } catch (error) {
      console.error("Error removing member:", error);
      res.status(500).json({ error: "Error removing member from group" });
    }
});

// ✅ **عرض جميع المجموعات (مع اسم آخر)**
app.get("/all-groups", authMiddleware, async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      where: {
        members: {
          some: {
            userId: req.userId,
          },
        },
      },
      include: {
        members: {
          select: {
            userId: true,
            isAdmin: true,
          },
        },
      },
    });

    res.status(200).json(groups);
  } catch (error) {
    res.status(500).json({ error: "حدث خطأ أثناء استرجاع المجموعات" });
  }
});

// Add new endpoint to get active chats
app.get("/active-chats", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    // Get all chats where the user is a participant
    const chats = await prisma.privateChat.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        user1: {
          select: {
            id: true,
            name: true
          }
        },
        user2: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Format the response to include only chats with messages
    const activeChats = chats
      .filter(chat => chat.messages.length > 0)
      .map(chat => {
        const lastMsg = chat.messages[0];
        return {
          id: chat.id,
          otherUser: chat.user1Id === userId ? chat.user2 : chat.user1,
          lastMessage: {
            ...lastMsg,
            content: lastMsg.content ? decryptText(lastMsg.content) : null
          }
        };
      })
      .sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));

    res.json(activeChats);
  } catch (error) {
    console.error("Error fetching active chats:", error);
    res.status(500).json({ error: "Error fetching active chats" });
  }
});

// Add endpoint for users to leave a group
app.delete("/groups/:groupid/members/:userId", authMiddleware, async (req, res) => {
  try {
    const { groupid, userId } = req.params;
    const currentUserId = req.userId;

    console.log("Leave group request:", {
      groupId: groupid,
      userId: userId,
      currentUserId: currentUserId
    });

    // Check if the user is trying to remove themselves
    if (userId !== currentUserId) {
      console.log("User mismatch:", { userId, currentUserId });
      return res.status(403).json({ error: "You can only remove yourself from the group" });
    }

    // First check if the group exists
    const group = await prisma.group.findUnique({
      where: { id: groupid },
      include: {
        members: true
      }
    });

    if (!group) {
      console.log("Group not found:", groupid);
      return res.status(404).json({ error: "Group not found" });
    }

    // Get the group member record
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        groupId: groupid,
        userId: userId
      }
    });

    console.log("Group member record:", groupMember);

    if (!groupMember) {
      console.log("Member not found in group");
      return res.status(404).json({ error: "You are not a member of this group" });
    }

    // Check if user is the last admin
    const adminCount = await prisma.groupMember.count({
      where: {
        groupId: groupid,
        isAdmin: true
      }
    });

    const isLastAdmin = groupMember.isAdmin && adminCount === 1;
    console.log("Admin check:", {
      isAdmin: groupMember.isAdmin,
      adminCount,
      isLastAdmin
    });

    if (isLastAdmin) {
      console.log("User is last admin");
      return res.status(400).json({ 
        error: "Cannot leave the group. You are the last admin. Please assign another admin first." 
      });
    }

    // Remove the member
    await prisma.groupMember.delete({
      where: {
        id: groupMember.id
      }
    });

    console.log("Member successfully removed");

    // Emit socket event
    io.to(`group-${groupid}`).emit("groupUpdated", { 
      groupId: groupid,
      action: "memberLeft",
      userId: userId
    });

    res.json({ message: "Successfully left the group" });
  } catch (error) {
    console.error("Error leaving group:", error);
    res.status(500).json({ 
      error: "Failed to leave the group",
      details: error.message 
    });
  }
});

// Delete a specific message
app.delete("/messages/:messageId", authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    // Get the message first to check ownership
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        group: {
          include: {
            members: true
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if user is the sender or a group admin
    const isGroupAdmin = message.group?.members.some(
      member => member.userId === userId && member.isAdmin
    );

    if (message.senderId !== userId && !isGroupAdmin) {
      return res.status(403).json({ error: "Not authorized to delete this message" });
    }

    // Delete the message
    await prisma.message.delete({
      where: { id: messageId }
    });

    // Emit socket event for real-time update
    if (message.groupId) {
      io.to(`group-${message.groupId}`).emit("messageDeleted", { messageId });
    } else if (message.chatId) {
      const chat = await prisma.privateChat.findUnique({
        where: { id: message.chatId }
      });
      if (chat) {
        io.to(`user-${chat.user1Id}`).emit("messageDeleted", { messageId });
        io.to(`user-${chat.user2Id}`).emit("messageDeleted", { messageId });
      }
    }

    res.json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ error: "Error deleting message" });
  }
});

// Delete all messages in a chat
app.delete("/chats/:chatId/messages", authMiddleware, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;

    // Check if user is part of the chat
    const chat = await prisma.privateChat.findUnique({
      where: { id: chatId }
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    if (chat.user1Id !== userId && chat.user2Id !== userId) {
      return res.status(403).json({ error: "Not authorized to delete messages in this chat" });
    }

    // Delete all messages in the chat
    await prisma.message.deleteMany({
      where: { chatId }
    });

    // Emit socket event for real-time update
    io.to(`user-${chat.user1Id}`).emit("chatCleared", { chatId });
    io.to(`user-${chat.user2Id}`).emit("chatCleared", { chatId });

    res.json({ message: "All messages deleted successfully" });
  } catch (error) {
    console.error("Error deleting messages:", error);
    res.status(500).json({ error: "Error deleting messages" });
  }
});

// Delete all messages in a group
app.delete("/groups/:groupId/messages", authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.userId;

    // Check if user is an admin of the group
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        isAdmin: true
      }
    });

    if (!groupMember) {
      return res.status(403).json({ error: "Only group admins can delete all messages" });
    }

    // Delete all messages in the group
    await prisma.message.deleteMany({
      where: { groupId }
    });

    // Emit socket event for real-time update
    io.to(`group-${groupId}`).emit("groupCleared", { groupId });

    res.json({ message: "All messages deleted successfully" });
  } catch (error) {
    console.error("Error deleting messages:", error);
    res.status(500).json({ error: "Error deleting messages" });
  }
});

// Edit a message
app.patch("/messages/:messageId", authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content, type, isEncrypted } = req.body;
    const userId = req.userId;
    let mediaUrl = null;

    // Get the message first to check ownership
    const message = await prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({ error: "Not authorized to edit this message" });
    }

    // Handle file upload if present
    if (req.file) {
      try {
        // Process file with FFmpeg if it's media
        let processedBuffer = req.file.buffer;
        if (type !== "TEXT") {
          processedBuffer = await processMediaFile(req.file.buffer, type, req.file.size);
        }

        // Determine resource type based on content type
        let resourceType = "auto";
        if (type === "IMAGE" || req.file.mimetype.startsWith('image/')) {
          resourceType = "image";
        } else if (type === "VIDEO" || req.file.mimetype.startsWith('video/')) {
          resourceType = "video";
        } else if (type === "AUDIO" || req.file.mimetype.startsWith('audio/')) {
          resourceType = "raw";
        }

        const result = await uploadToCloudinary(processedBuffer, "chat-media", resourceType);
        mediaUrl = result.secure_url;
      } catch (uploadError) {
        console.error("Error uploading to Cloudinary:", uploadError);
        return res.status(500).json({ 
          error: uploadError.message || "Failed to upload media file",
          details: uploadError
        });
      }
    }

    // تشفير الرسالة قبل الحفظ
    const encryptedContent = content ? encryptText(content) : null;

    // Update the message
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { 
        content: encryptedContent,
        type: type || message.type,
        mediaUrl: mediaUrl || message.mediaUrl
      },
      include: {
        sender: { select: { id: true, name: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: { select: { name: true } }
          }
        }
      }
    });

    // Add encryption flag to the response
    const messageWithEncryption = {
      ...updatedMessage,
      isEncrypted: isEncrypted === 'true'
    };

    // فك تشفير الرسالة والرد قبل الإرسال
    const decryptedMessage = {
      ...messageWithEncryption,
      content: messageWithEncryption.content ? decryptText(messageWithEncryption.content) : null,
      replyTo: messageWithEncryption.replyTo ? {
        ...messageWithEncryption.replyTo,
        content: messageWithEncryption.replyTo.content ? decryptText(messageWithEncryption.replyTo.content) : null
      } : null
    };

    // Emit socket event for real-time update
    if (message.groupId) {
      io.to(`group-${message.groupId}`).emit("messageEdited", decryptedMessage);
    } else if (message.chatId) {
      const chat = await prisma.privateChat.findUnique({
        where: { id: message.chatId }
      });
      if (chat) {
        io.to(`user-${chat.user1Id}`).emit("messageEdited", decryptedMessage);
        io.to(`user-${chat.user2Id}`).emit("messageEdited", decryptedMessage);
      }
    }

    res.json(decryptedMessage);
  } catch (error) {
    console.error("Error editing message:", error);
    res.status(500).json({ error: "Error editing message" });
  }
});

// Delete a group (admin only)
app.delete("/groups/:groupId", authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.userId;

    // Check if user is the group creator
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (group.creatorId !== userId) {
      return res.status(403).json({ error: "Only the group creator can delete the group" });
    }

    // Delete all messages in the group first
    await prisma.message.deleteMany({
      where: { groupId }
    });

    // Delete all group members
    await prisma.groupMember.deleteMany({
      where: { groupId }
    });

    // Delete the group
    await prisma.group.delete({
      where: { id: groupId }
    });

    // Emit socket event for real-time update
    io.to(`group-${groupId}`).emit("groupDeleted", { groupId });

    res.json({ message: "Group deleted successfully" });
  } catch (error) {
    console.error("Error deleting group:", error);
    res.status(500).json({ error: "Error deleting group" });
  }
});

// Start the server
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

//npx prisma studio
//npx prisma migrate deploy
//npx prisma generate
//npx prisma migrate
//npx prisma migrate reset
//npx prisma migrate dev --name init

//npm cache clean --force
//npx prisma format
//1 npm init -y
//2 npm install prisma --save-dev
//3 npm install @prisma/client
//4 npm install express   bcryptjs cors dotenv socket.io   cookie-parser jsonwebtoken
//5 npx prisma init














