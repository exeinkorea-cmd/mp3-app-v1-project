import React, { useState, useEffect, useCallback } from "react";
import "./App.css";
import "./styles/globals.css";
import { auth, functions, db } from "./firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { connectFunctionsEmulator } from "firebase/functions";
import { httpsCallable } from "firebase/functions";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import SignInForm from "./components/SignInForm";
import BulletinDashboard from "./components/BulletinDashboard";
import AttendanceList from "./components/AttendanceList";
import DashboardHeader from "./components/DashboardHeader";
import MainTitleSection from "./components/MainTitleSection";
import StatsCards from "./components/StatsCards";
import StatsChat from "./components/StatsChat";
import TeamRequestList from "./components/TeamRequestList";
import ToastContainer from "./components/ToastContainer";
import { EmergencyAlert, TeamRequest, SiteStatusLog } from "./types";
import { DesignTokens } from "./constants/designTokens";

interface Toast {
  id: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  duration?: number;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isRevoking, setIsRevoking] = useState<boolean>(false);

  useEffect(() => {
    // (가상 서버 연결 코드는 '집 안'으로!)
    if (window.location.hostname === "localhost") {
      console.log(
        "Firebase Functions 에뮬레이터(localhost:5001)에 연결합니다..."
      );
      try {
        connectFunctionsEmulator(functions, "127.0.0.1", 5001);
        console.log("Functions 에뮬레이터 연결 성공!");
      } catch (e) {
        console.error("Functions 에뮬레이터 연결 실패:", e);
      }
    }

    // 실제 Firebase Auth 상태 감시
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      if (firebaseUser) {
        console.log("로그인된 사용자:", firebaseUser.email);
      } else {
        console.log("로그인되지 않음");
      }
    });

    return () => unsubscribe();
  }, []);

  // 실시간 긴급 알림 수신
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "emergencyAlerts"),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const alertData = change.doc.data() as EmergencyAlert;
          // 화재 알림만 표시
          if (alertData.type === "fire") {
            const message =
              alertData.translations?.ko || alertData.message || "화재발생";
            window.alert(
              `🚨 ${message}\n\n신고자: ${
                alertData.userName || "알 수 없음"
              }\n소속: ${alertData.department || "알 수 없음"}`
            );
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user]);

  // 실시간 소속 추가 요청 알림 수신
  useEffect(() => {
    if (!user) return;

    // 인덱스 오류를 방지하기 위해 where만 사용하고 클라이언트에서 필터링
    const q = query(
      collection(db, "teamRequests"),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const requestData = change.doc.data() as TeamRequest;

          // pending 상태인 요청만 알림 표시
          if (requestData.status === "pending") {
            const teamName = requestData.requestedTeamName || "알 수 없음";

            // Toast 알림 추가
            const toastId = `team-request-${change.doc.id}-${Date.now()}`;
            setToasts((prev) => [
              ...prev,
              {
                id: toastId,
                message: `새로운 소속 추가 요청: ${teamName}`,
                type: "info",
              },
            ]);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user]);

  // 실시간 현장 상태 로그 알림 수신
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "siteStatusLogs"),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const logData = change.doc.data() as SiteStatusLog;

          // Toast 알림 표시
          const toastId = `site-status-${change.doc.id}-${Date.now()}`;
          setToasts((prev) => [
            ...prev,
            {
              id: toastId,
              message: logData.message,
              type: "warning",
            },
          ]);
        }
      });
    });

    return () => unsubscribe();
  }, [user]);

  // Toast 닫기 핸들러
  const handleCloseToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const handleLogout = async (): Promise<void> => {
    try {
      await signOut(auth);
      alert("로그아웃되었습니다.");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`로그아웃 실패: ${errorMessage}`);
    }
  };

  // 수동 초기화 핸들러
  const handleManualReset = async (): Promise<void> => {
    const confirmed = window.confirm(
      "⚠️ 경고: 모든 출석 및 공지 데이터가 삭제됩니다. 진행하시겠습니까?"
    );

    if (!confirmed) return;

    setIsResetting(true);

    try {
      const manualResetData = httpsCallable(functions, "manualResetData");
      const result = await manualResetData();

      const data = result.data as { success: boolean; message: string };
      if (data.success) {
        alert("초기화 완료");
        window.location.reload(); // 페이지 강제 새로고침
      } else {
        alert("초기화 실패: " + (data.message || "알 수 없는 오류"));
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`초기화 실패: ${errorMessage}`);
      console.error("수동 초기화 오류:", error);
    } finally {
      setIsResetting(false);
    }
  };

  // 전체 강제 로그아웃 핸들러
  const handleRevokeSessions = async (): Promise<void> => {
    const confirmed = window.confirm(
      "⚠️ 모든 사용자의 로그인이 풀립니다. 데이터는 유지됩니다. 진행할까요?"
    );

    if (!confirmed) return;

    setIsRevoking(true);

    try {
      const manualRevokeSessions = httpsCallable(
        functions,
        "manualRevokeSessions"
      );
      const result = await manualRevokeSessions();

      const data = result.data as { success: boolean; message: string };
      if (data.success) {
        alert(data.message || "전체 사용자 강제 로그아웃 완료");
        window.location.reload(); // 페이지 강제 새로고침
      } else {
        alert("로그아웃 실패: " + (data.message || "알 수 없는 오류"));
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`로그아웃 실패: ${errorMessage}`);
      console.error("전체 강제 로그아웃 오류:", error);
    } finally {
      setIsRevoking(false);
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 flex flex-col">
      {user && (
        <DashboardHeader
          user={user}
          onLogout={handleLogout}
          onManualReset={handleManualReset}
          isResetting={isResetting}
          onRevokeSessions={handleRevokeSessions}
          isRevoking={isRevoking}
        />
      )}
      <ToastContainer toasts={toasts} onClose={handleCloseToast} />
      <div className="flex-1 overflow-y-auto">
        <div
          style={{
            padding: "32px 40px",
            maxWidth: "1400px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          {user ? (
            <>
              <MainTitleSection />
              <StatsCards />
              {/* 공지 보내기 - 통계 카드 바로 아래 */}
              <div
                style={{
                  marginTop: DesignTokens.spacing.xl,
                  marginBottom: DesignTokens.spacing.xl,
                }}
              >
                <BulletinDashboard user={user} />
              </div>
              <StatsChat />
              <AttendanceList />
              <TeamRequestList />
            </>
          ) : (
            <div className="flex items-center justify-center min-h-full">
              <SignInForm />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
