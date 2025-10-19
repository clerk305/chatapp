"use client";

import React, { useState, useEffect } from 'react';
import encryptionManager from '../utils/encryption';
import { toast } from 'react-hot-toast';

const EncryptionManager = ({ userId, onKeyGenerated }) => {
  const [hasUserKey, setHasUserKey] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [backupData, setBackupData] = useState('');
  const [importData, setImportData] = useState('');
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    if (userId) {
      const key = encryptionManager.loadUserKey(userId);
      setHasUserKey(!!key);
    }
  }, [userId]);

  const generateUserKey = () => {
    try {
      const newKey = encryptionManager.generateUserKey();
      encryptionManager.saveUserKey(userId, newKey);
      setHasUserKey(true);
      onKeyGenerated && onKeyGenerated(newKey);
      toast.success('تم إنشاء مفتاح التشفير بنجاح');
    } catch (error) {
      console.error('خطأ في إنشاء المفتاح:', error);
      toast.error('فشل في إنشاء مفتاح التشفير');
    }
  };

  const exportKeys = () => {
    try {
      const keysData = encryptionManager.exportKeys();
      setBackupData(keysData);
      setShowBackup(true);
      toast.success('تم تصدير المفاتيح بنجاح');
    } catch (error) {
      console.error('خطأ في تصدير المفاتيح:', error);
      toast.error('فشل في تصدير المفاتيح');
    }
  };

  const importKeys = () => {
    try {
      if (!importData.trim()) {
        toast.error('يرجى إدخال بيانات النسخ الاحتياطي');
        return;
      }

      const success = encryptionManager.importKeys(importData);
      if (success) {
        setHasUserKey(true);
        setImportData('');
        setShowImport(false);
        toast.success('تم استيراد المفاتيح بنجاح');
      } else {
        toast.error('فشل في استيراد المفاتيح - بيانات غير صحيحة');
      }
    } catch (error) {
      console.error('خطأ في استيراد المفاتيح:', error);
      toast.error('فشل في استيراد المفاتيح');
    }
  };

  const clearAllKeys = () => {
    if (confirm('هل أنت متأكد من حذف جميع مفاتيح التشفير؟ هذا الإجراء لا يمكن التراجع عنه.')) {
      encryptionManager.clearAllKeys();
      setHasUserKey(false);
      setBackupData('');
      setImportData('');
      setShowBackup(false);
      setShowImport(false);
      toast.success('تم حذف جميع المفاتيح');
    }
  };

  const downloadBackup = () => {
    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `encryption-keys-${userId}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
        إدارة التشفير
      </h2>
      
      <div className="space-y-4">
        {/* حالة المفتاح */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <span className="text-sm font-medium text-gray-700">مفتاح التشفير:</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            hasUserKey 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {hasUserKey ? 'مفعل' : 'غير مفعل'}
          </span>
        </div>

        {/* إنشاء مفتاح جديد */}
        {!hasUserKey && (
          <button
            onClick={generateUserKey}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
          >
            إنشاء مفتاح التشفير
          </button>
        )}

        {/* تصدير المفاتيح */}
        {hasUserKey && (
          <button
            onClick={exportKeys}
            className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
          >
            تصدير المفاتيح (نسخ احتياطي)
          </button>
        )}

        {/* استيراد المفاتيح */}
        {!hasUserKey && (
          <button
            onClick={() => setShowImport(true)}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
          >
            استيراد المفاتيح
          </button>
        )}

        {/* حذف جميع المفاتيح */}
        {hasUserKey && (
          <button
            onClick={clearAllKeys}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
          >
            حذف جميع المفاتيح
          </button>
        )}

        {/* معلومات التشفير */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">معلومات التشفير:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• التشفير من طرف إلى طرف (End-to-End)</li>
            <li>• المفاتيح محفوظة محلياً فقط</li>
            <li>• لا يمكن للخادم قراءة الرسائل المشفرة</li>
            <li>• احتفظ بنسخة احتياطية من المفاتيح</li>
          </ul>
        </div>
      </div>

      {/* نافذة تصدير المفاتيح */}
      {showBackup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">تصدير المفاتيح</h3>
            <p className="text-sm text-gray-600 mb-4">
              احتفظ بهذه البيانات في مكان آمن. ستحتاج إليها لاستعادة مفاتيح التشفير.
            </p>
            <textarea
              value={backupData}
              readOnly
              className="w-full h-32 p-2 border rounded-lg text-xs font-mono bg-gray-50"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={downloadBackup}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg"
              >
                تحميل الملف
              </button>
              <button
                onClick={() => setShowBackup(false)}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة استيراد المفاتيح */}
      {showImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">استيراد المفاتيح</h3>
            <p className="text-sm text-gray-600 mb-4">
              الصق بيانات النسخ الاحتياطي هنا لاستعادة مفاتيح التشفير.
            </p>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="الصق بيانات النسخ الاحتياطي هنا..."
              className="w-full h-32 p-2 border rounded-lg text-xs font-mono"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={importKeys}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg"
              >
                استيراد
              </button>
              <button
                onClick={() => {
                  setShowImport(false);
                  setImportData('');
                }}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EncryptionManager; 