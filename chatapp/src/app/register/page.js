//app/src/register/page.js
"use client";

import React, { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

const RegisterPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!name || !email || !password) {
        setError("جميع الحقول مطلوبة");
        return;
      }

      const response = await axios.post("http://localhost:4000/signup", {
        name,
        email,
        password,
      });

      setSuccess("تم إنشاء الحساب بنجاح! تحقق من بريدك الإلكتروني.");
      setError("");

      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (error) {
      console.error("❌ خطأ في التسجيل:", error);
      setError(error.response?.data?.error || "حدث خطأ أثناء التسجيل");
    }
  };

  return (
    <div>
      <h1>إنشاء حساب</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="الاسم"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="email"
          placeholder="البريد الإلكتروني"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="كلمة المرور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">تسجيل</button>
      </form>
    </div>
  );
};

export default RegisterPage;