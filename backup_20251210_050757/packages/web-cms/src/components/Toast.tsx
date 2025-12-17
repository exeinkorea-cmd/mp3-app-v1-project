import React, { useEffect } from "react";
import { X } from "lucide-react";
import { DesignTokens } from "../constants/designTokens";

export interface ToastProps {
  id: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  duration?: number;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({
  id,
  message,
  type = "info",
  duration = 5000,
  onClose,
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  const getToastStyles = () => {
    const baseStyle = {
      backgroundColor: DesignTokens.colors.background.default,
      border: `1px solid ${DesignTokens.colors.border.default}`,
      borderRadius: DesignTokens.borderRadius.lg,
      padding: DesignTokens.spacing.md,
      boxShadow: DesignTokens.shadows.lg,
      minWidth: "300px",
      maxWidth: "500px",
    };

    switch (type) {
      case "success":
        return {
          ...baseStyle,
          borderColor: DesignTokens.colors.status.success.text,
          backgroundColor: DesignTokens.colors.status.success.bg,
        };
      case "warning":
        return {
          ...baseStyle,
          borderColor: DesignTokens.colors.status.warning.text,
          backgroundColor: DesignTokens.colors.status.warning.bg,
        };
      case "error":
        return {
          ...baseStyle,
          borderColor: DesignTokens.colors.status.error.text,
          backgroundColor: DesignTokens.colors.status.error.bg,
        };
      default:
        return {
          ...baseStyle,
          borderColor: DesignTokens.colors.status.info.text,
          backgroundColor: DesignTokens.colors.status.info.bg,
        };
    }
  };

  const getTextColor = () => {
    switch (type) {
      case "success":
        return DesignTokens.colors.status.success.text;
      case "warning":
        return DesignTokens.colors.status.warning.text;
      case "error":
        return DesignTokens.colors.status.error.text;
      default:
        return DesignTokens.colors.status.info.text;
    }
  };

  return (
    <div
      style={{
        ...getToastStyles(),
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: DesignTokens.spacing.sm,
        animation: "slideIn 0.3s ease-out",
      }}
    >
      <span
        style={{
          ...DesignTokens.typography.bodySmall,
          color: getTextColor(),
          flex: 1,
        }}
      >
        {message}
      </span>
      <button
        onClick={() => onClose(id)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: DesignTokens.spacing.xs,
          display: "flex",
          alignItems: "center",
          color: getTextColor(),
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.7";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
      >
        <X size={16} />
      </button>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default Toast;















