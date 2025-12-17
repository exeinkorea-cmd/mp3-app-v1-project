import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User as UserIcon } from "lucide-react";
import { askGemini } from "../utils/gemini";
import { DesignTokens } from "../constants/designTokens";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
}

const StatsChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "안녕하세요! 오아이 매니저입니다. 무엇을 도와드릴까요?",
      sender: "ai",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 메시지 추가 시 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      const aiResponse = await askGemini(inputText.trim());
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: aiResponse,
        sender: "ai",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "알 수 없는 오류";
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: `오류가 발생했습니다: ${errorMessage}`,
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        backgroundColor: DesignTokens.colors.background.default,
        borderRadius: DesignTokens.borderRadius.lg,
        border: `1px solid ${DesignTokens.colors.border.default}`,
        boxShadow: DesignTokens.shadows.md,
        display: "flex",
        flexDirection: "column",
      height: "600px",
      maxHeight: "80vh",
      marginBottom: DesignTokens.spacing.xl, // 32px (mb-8에 해당)
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          padding: DesignTokens.spacing.md,
          borderBottom: `1px solid ${DesignTokens.colors.border.default}`,
          backgroundColor: DesignTokens.colors.background.paper,
          borderRadius: `${DesignTokens.borderRadius.lg} ${DesignTokens.borderRadius.lg} 0 0`,
          display: "flex",
          alignItems: "center",
          gap: DesignTokens.spacing.sm,
        }}
      >
        <Bot
          size={20}
          style={{ color: DesignTokens.colors.primary.main }}
        />
        <h3
          style={{
            ...DesignTokens.typography.h4,
            lineHeight: 0,
            margin: 0,
            color: DesignTokens.colors.text.primary,
          }}
        >
          데이터 분석 챗봇
        </h3>
      </div>

      {/* 메시지 영역 */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: DesignTokens.spacing.md,
          display: "flex",
          flexDirection: "column",
          gap: DesignTokens.spacing.sm,
        }}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: "flex",
              justifyContent: message.sender === "user" ? "flex-end" : "flex-start",
              alignItems: "flex-start",
              gap: DesignTokens.spacing.sm,
            }}
          >
            {message.sender === "ai" && (
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  backgroundColor: DesignTokens.colors.primary.main,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Bot size={16} color={DesignTokens.colors.text.inverse} />
              </div>
            )}
            <div
              style={{
                maxWidth: "70%",
                padding: DesignTokens.spacing.md,
                borderRadius: DesignTokens.borderRadius.md,
                backgroundColor:
                  message.sender === "user"
                    ? DesignTokens.colors.primary.main
                    : DesignTokens.colors.background.paper,
                border:
                  message.sender === "ai"
                    ? `1px solid ${DesignTokens.colors.border.default}`
                    : "none",
                boxShadow: DesignTokens.shadows.sm,
              }}
            >
              <p
                style={{
                  ...DesignTokens.typography.body,
                  lineHeight: 1.5,
                  margin: 0,
                  color:
                    message.sender === "user"
                      ? DesignTokens.colors.text.inverse
                      : DesignTokens.colors.text.primary,
                  whiteSpace: "pre-wrap",
                }}
              >
                {message.text}
              </p>
              <span
                style={{
                  ...DesignTokens.typography.caption,
                  color:
                    message.sender === "user"
                      ? "rgba(255, 255, 255, 0.7)"
                      : DesignTokens.colors.text.secondary,
                  marginTop: DesignTokens.spacing.xs,
                  display: "block",
                }}
              >
                {message.timestamp.toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {message.sender === "user" && (
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  backgroundColor: DesignTokens.colors.background.secondary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <UserIcon size={16} color={DesignTokens.colors.text.secondary} />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
              alignItems: "flex-start",
              gap: DesignTokens.spacing.sm,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                backgroundColor: DesignTokens.colors.primary.main,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Bot size={16} color={DesignTokens.colors.text.inverse} />
            </div>
            <div
              style={{
                padding: DesignTokens.spacing.md,
                borderRadius: DesignTokens.borderRadius.md,
                backgroundColor: DesignTokens.colors.background.paper,
                border: `1px solid ${DesignTokens.colors.border.default}`,
              }}
            >
              <span
                style={{
                  ...DesignTokens.typography.bodySmall,
                  color: DesignTokens.colors.text.secondary,
                }}
              >
                분석 중...
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div
        style={{
          padding: DesignTokens.spacing.md,
          borderTop: `1px solid ${DesignTokens.colors.border.default}`,
          backgroundColor: DesignTokens.colors.background.paper,
          display: "flex",
          gap: DesignTokens.spacing.sm,
          alignItems: "flex-end",
        }}
      >
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="오늘 출역한 팀을 보여줘."
          disabled={isLoading}
          style={{
            flex: 1,
            minHeight: "40px",
            maxHeight: "120px",
            padding: DesignTokens.spacing.sm,
            ...DesignTokens.typography.body,
            border: `1px solid ${DesignTokens.colors.border.dark}`,
            borderRadius: DesignTokens.borderRadius.md,
            backgroundColor: DesignTokens.colors.background.default,
            resize: "none",
            opacity: isLoading ? 0.5 : 1,
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !inputText.trim()}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: DesignTokens.borderRadius.md,
            backgroundColor: DesignTokens.colors.primary.main,
            border: "none",
            cursor: isLoading || !inputText.trim() ? "not-allowed" : "pointer",
            opacity: isLoading || !inputText.trim() ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => {
            if (!isLoading && inputText.trim()) {
              e.currentTarget.style.opacity = "0.8";
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading && inputText.trim()) {
              e.currentTarget.style.opacity = "1";
            }
          }}
        >
          <Send
            size={20}
            color={DesignTokens.colors.text.inverse}
          />
        </button>
      </div>
    </div>
  );
};

export default StatsChat;

