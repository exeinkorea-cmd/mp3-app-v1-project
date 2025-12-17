import React from "react";
import Toast, { ToastProps } from "./Toast";
import { DesignTokens } from "../constants/designTokens";

export interface ToastContainerProps {
  toasts: Array<Omit<ToastProps, "onClose">>;
  onClose: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: DesignTokens.spacing.lg,
        right: DesignTokens.spacing.lg,
        zIndex: DesignTokens.zIndex.tooltip,
        display: "flex",
        flexDirection: "column",
        gap: DesignTokens.spacing.sm,
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: "auto" }}>
          <Toast {...toast} onClose={onClose} />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;

