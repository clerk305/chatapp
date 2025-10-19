//app/src/login/page.js
"use client";
import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post("http://localhost:4000/signin", { email, password }, { withCredentials: true });
      router.push("/");
    } catch (error) {
      alert("فشل تسجيل الدخول، تأكد من البريد وكلمة المرور.");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">تسجيل الدخول</button>
    </form>
  );
}
