import React, { useState, FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { SignInFormProps } from "../types";
import { DesignTokens } from "../constants/designTokens";

const SignInForm: React.FC<SignInFormProps> = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // 로그인 성공 시 onAuthStateChanged가 자동으로 user를 업데이트합니다
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "로그인에 실패했습니다.";
      setError(errorMessage);
      console.error("로그인 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col w-full max-w-md"
      style={{
        gap: DesignTokens.spacing.md,
        backgroundColor: DesignTokens.colors.background.default,
        padding: DesignTokens.spacing.lg,
        borderRadius: DesignTokens.borderRadius.lg,
        boxShadow: DesignTokens.shadows.sm,
        border: `1px solid ${DesignTokens.colors.border.default}`,
      }}
    >
      <h2
        style={{
          ...DesignTokens.typography.h2,
          lineHeight: 0,
          color: DesignTokens.colors.text.primary,
          marginBottom: DesignTokens.spacing.sm,
        }}
      >
        CMS 로그인
      </h2>
      {error && (
        <p
          style={{
            ...DesignTokens.typography.bodySmall,
            lineHeight: 0,
            color: DesignTokens.colors.status.error.text,
          }}
        >
          {error}
        </p>
      )}
      <input
        name="email"
        type="email"
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={isLoading}
        className="w-full focus:outline-none resize-none"
        style={{
          height: 40,
          paddingLeft: DesignTokens.spacing.md,
          paddingRight: DesignTokens.spacing.md,
          ...DesignTokens.typography.body,
          lineHeight: 0,
          border: `1px solid ${DesignTokens.colors.border.default}`,
          borderRadius: DesignTokens.borderRadius.md,
          backgroundColor: DesignTokens.colors.background.default,
          opacity: isLoading ? 0.5 : 1,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = DesignTokens.colors.primary.main;
          e.currentTarget.style.boxShadow = `0 0 0 2px ${DesignTokens.colors.primary.light}40`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor =
            DesignTokens.colors.border.default;
          e.currentTarget.style.boxShadow = "none";
        }}
      />
      <input
        name="password"
        type="password"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        disabled={isLoading}
        className="w-full focus:outline-none resize-none"
        style={{
          height: 40,
          paddingLeft: DesignTokens.spacing.md,
          paddingRight: DesignTokens.spacing.md,
          ...DesignTokens.typography.body,
          lineHeight: 0,
          border: `1px solid ${DesignTokens.colors.border.default}`,
          borderRadius: DesignTokens.borderRadius.md,
          backgroundColor: DesignTokens.colors.background.default,
          opacity: isLoading ? 0.5 : 1,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = DesignTokens.colors.primary.main;
          e.currentTarget.style.boxShadow = `0 0 0 2px ${DesignTokens.colors.primary.light}40`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor =
            DesignTokens.colors.border.default;
          e.currentTarget.style.boxShadow = "none";
        }}
      />
      <button
        type="submit"
        disabled={isLoading}
        className="w-full transition-opacity disabled:cursor-not-allowed"
        style={{
          height: 40,
          ...DesignTokens.typography.body,
          fontWeight: 500,
          borderRadius: DesignTokens.borderRadius.md,
          backgroundColor: DesignTokens.colors.primary.main,
          color: DesignTokens.colors.text.inverse,
          opacity: isLoading ? 0.5 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isLoading) {
            e.currentTarget.style.opacity = "0.9";
          }
        }}
        onMouseLeave={(e) => {
          if (!isLoading) {
            e.currentTarget.style.opacity = "1";
          }
        }}
      >
        {isLoading ? "로그인 중..." : "로그인"}
      </button>
      <p
        style={{
          ...DesignTokens.typography.caption,
          lineHeight: 0,
          color: DesignTokens.colors.text.secondary,
          marginTop: DesignTokens.spacing.sm,
        }}
      >
        💡 Firebase Console에서 사용자를 먼저 생성해주세요.
        <br />
        (Authentication &gt; 사용자 추가)
      </p>
    </form>
  );
};

export default SignInForm;
