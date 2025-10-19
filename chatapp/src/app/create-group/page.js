//src/app/create-group/page.js
"use client";
import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

const CreateGroupPage = () => {
  const [groupName, setGroupName] = useState(""); // حالة لتخزين اسم المجموعة
  const router = useRouter(); // لاستخدام التوجيه

  const handleCreateGroup = async () => {
    try {
      // إرسال طلب POST إلى الخادم لإنشاء المجموعة
      const response = await axios.post(
        "http://localhost:4000/groups", // العنوان الذي يتم إرسال الطلب إليه
        { name: groupName }, // البيانات (اسم المجموعة)
        { withCredentials: true } // إرسال الكوكيز مع الطلب (إذا كان مطلوبًا)
      );
      // إذا تم إنشاء المجموعة بنجاح، يتم توجيه المستخدم إلى الصفحة الرئيسية
      alert(response.data.message); // عرض رسالة النجاح
      router.push("/"); // العودة إلى الصفحة الرئيسية
    } catch (error) {
      console.error("❌ Error creating group:", error);
      alert("حدث خطأ أثناء إنشاء المجموعة."); // عرض رسالة خطأ إذا فشل الإنشاء
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>إنشاء مجموعة جديدة</h1>
      <input
        type="text"
        placeholder="اسم المجموعة"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)} // تحديث القيمة عند الكتابة
        style={{ padding: "10px", width: "300px", marginBottom: "10px" }}
      />
      <br />
      <button
        onClick={handleCreateGroup}
        style={{
          padding: "10px 20px",
          backgroundColor: "#4CAF50",
          color: "white",
          border: "none",
          cursor: "pointer",
        }}
      >
        إنشاء المجموعة
      </button>
    </div>
  );
};

export default CreateGroupPage;
