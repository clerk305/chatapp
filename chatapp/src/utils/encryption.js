import CryptoJS from 'crypto-js';

// إدارة المفاتيح المحلية
class EncryptionManager {
  constructor() {
    this.userKey = null;
    this.userId = null;
    this.chatKeys = new Map(); // تخزين مفاتيح المحادثات
  }

  // إنشاء مفتاح عشوائي للمستخدم
  generateUserKey() {
    return CryptoJS.lib.WordArray.random(256/8).toString();
  }

  // حفظ مفتاح المستخدم في localStorage
  saveUserKey(userId, key) {
    this.userId = userId;
    this.userKey = key;
    localStorage.setItem(`userKey_${userId}`, key);
  }

  // استرجاع مفتاح المستخدم من localStorage
  loadUserKey(userId) {
    this.userId = userId;
    this.userKey = localStorage.getItem(`userKey_${userId}`);
    return this.userKey;
  }

  // إنشاء مفتاح مشترك للمحادثة
  generateChatKey() {
    return CryptoJS.lib.WordArray.random(256/8).toString();
  }

  // حفظ مفتاح المحادثة
  saveChatKey(chatId, key) {
    this.chatKeys.set(chatId, key);
    localStorage.setItem(`chatKey_${chatId}`, key);
  }

  // استرجاع مفتاح المحادثة
  loadChatKey(chatId) {
    if (this.chatKeys.has(chatId)) {
      return this.chatKeys.get(chatId);
    }
    const key = localStorage.getItem(`chatKey_${chatId}`);
    if (key) {
      this.chatKeys.set(chatId, key);
    }
    return key;
  }

  // تشفير الرسالة
  encryptMessage(message, chatKey) {
    if (!chatKey) {
      console.warn('لا يوجد مفتاح تشفير، إرجاع الرسالة كما هي');
      return message;
    }

    try {
      const encrypted = CryptoJS.AES.encrypt(message, chatKey).toString();
      return encrypted;
    } catch (error) {
      console.error('خطأ في تشفير الرسالة:', error);
      return message; // إرجاع الرسالة كما هي في حالة الخطأ
    }
  }

  // فك تشفير الرسالة
  decryptMessage(encryptedMessage, chatKey) {
    if (!chatKey) {
      console.warn('لا يوجد مفتاح تشفير، إرجاع الرسالة كما هي');
      return encryptedMessage;
    }

    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedMessage, chatKey);
      const originalText = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!originalText) {
        console.warn('فشل في فك تشفير الرسالة، إرجاعها كما هي');
        return encryptedMessage;
      }
      
      return originalText;
    } catch (error) {
      console.warn('خطأ في فك تشفير الرسالة، إرجاعها كما هي:', error.message);
      return encryptedMessage; // إرجاع الرسالة كما هي في حالة الخطأ
    }
  }

  // تشفير الملفات (للصور والفيديوهات والملفات الصوتية)
  encryptFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const arrayBuffer = e.target.result;
          const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
          const encrypted = CryptoJS.AES.encrypt(wordArray, this.userKey).toString();
          resolve(encrypted);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // فك تشفير الملفات
  decryptFile(encryptedData) {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedData, this.userKey);
      const arrayBuffer = decrypted.toArrayBuffer();
      return new Blob([arrayBuffer]);
    } catch (error) {
      console.error('خطأ في فك تشفير الملف:', error);
      throw new Error('فشل في فك تشفير الملف');
    }
  }

  // إنشاء مفتاح مشترك للمحادثة الجديدة
  createNewChatKey(chatId) {
    const newKey = this.generateChatKey();
    this.saveChatKey(chatId, newKey);
    return newKey;
  }

  // التحقق من وجود مفتاح للمحادثة
  hasChatKey(chatId) {
    return this.loadChatKey(chatId) !== null;
  }

  // حذف مفتاح المحادثة
  deleteChatKey(chatId) {
    this.chatKeys.delete(chatId);
    localStorage.removeItem(`chatKey_${chatId}`);
  }

  // حذف جميع المفاتيح
  clearAllKeys() {
    this.userKey = null;
    this.userId = null;
    this.chatKeys.clear();
    
    // حذف جميع المفاتيح من localStorage
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('userKey_') || key.startsWith('chatKey_')) {
        localStorage.removeItem(key);
      }
    });
  }

  // تصدير المفاتيح للنسخ الاحتياطي
  exportKeys() {
    const keys = {
      userId: this.userId,
      userKey: this.userKey,
      chatKeys: {}
    };

    this.chatKeys.forEach((key, chatId) => {
      keys.chatKeys[chatId] = key;
    });

    return JSON.stringify(keys);
  }

  // استيراد المفاتيح من النسخ الاحتياطي
  importKeys(keysData) {
    try {
      const keys = JSON.parse(keysData);
      this.userId = keys.userId;
      this.userKey = keys.userKey;
      
      Object.keys(keys.chatKeys).forEach(chatId => {
        this.saveChatKey(chatId, keys.chatKeys[chatId]);
      });

      return true;
    } catch (error) {
      console.error('خطأ في استيراد المفاتيح:', error);
      return false;
    }
  }

  // إنشاء مفتاح مشترك بين مستخدمين (مثل واتساب)
  generateSharedKey(user1Id, user2Id) {
    // إنشاء مفتاح مشترك ثابت بناءً على معرفات المستخدمين
    const combinedIds = [user1Id, user2Id].sort().join('_');
    return CryptoJS.SHA256(combinedIds).toString();
  }

  // حفظ مفتاح مشترك للمحادثة
  saveSharedChatKey(chatId, user1Id, user2Id) {
    const sharedKey = this.generateSharedKey(user1Id, user2Id);
    this.saveChatKey(chatId, sharedKey);
    return sharedKey;
  }

  // التحقق من أن الرسالة مشفرة
  isEncryptedMessage(message) {
    try {
      // التحقق من أن الرسالة تحتوي على نص مشفر (base64)
      if (typeof message !== 'string') return false;
      
      // النص المشفر عادة يكون أطول من النص العادي
      if (message.length < 20) return false;
      
      // التحقق من أن النص يحتوي على أحرف base64 فقط
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      return base64Regex.test(message);
    } catch (error) {
      return false;
    }
  }

  // محاولة فك تشفير الرسالة تلقائياً
  tryDecryptMessage(message, chatKey) {
    if (!this.isEncryptedMessage(message)) {
      return message; // الرسالة غير مشفرة
    }

    try {
      return this.decryptMessage(message, chatKey);
    } catch (error) {
      console.log('فشل في فك تشفير الرسالة، قد تكون غير مشفرة:', error.message);
      return message; // إرجاع الرسالة كما هي
    }
  }

  // إنشاء مفتاح المستخدم تلقائياً إذا لم يكن موجوداً
  ensureUserKey(userId) {
    let userKey = this.loadUserKey(userId);
    if (!userKey) {
      userKey = this.generateUserKey();
      this.saveUserKey(userId, userKey);
    }
    return userKey;
  }

  // إنشاء مفتاح المحادثة تلقائياً إذا لم يكن موجوداً
  ensureChatKey(chatId, user1Id, user2Id) {
    let chatKey = this.loadChatKey(chatId);
    if (!chatKey) {
      chatKey = this.saveSharedChatKey(chatId, user1Id, user2Id);
    }
    return chatKey;
  }
}

// إنشاء نسخة واحدة من مدير التشفير
const encryptionManager = new EncryptionManager();

export default encryptionManager; 