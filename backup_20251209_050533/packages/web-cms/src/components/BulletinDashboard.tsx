import React, { useState, useEffect, useCallback } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  updateDoc,
  where,
  getDocs,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  BulletinDashboardProps,
  TranslateResponse,
  Department,
} from "../types";
import { callTestTranslate } from "../utils/translate";
import { DesignTokens } from "../constants/designTokens";
import { Calendar } from "lucide-react";
import TargetSelector from "./TargetSelector";

const BulletinDashboard: React.FC<BulletinDashboardProps> = ({ user }) => {
  const [title, setTitle] = useState<string>("");
  const [originalText, setOriginalText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSent, setIsSent] = useState<boolean>(false);
  const [targetType, setTargetType] = useState<"all" | "company" | "team">(
    "all"
  );
  const [targetValue, setTargetValue] = useState<string | null>(null);
  const [isPersistent, setIsPersistent] = useState<boolean>(false);
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [departments, setDepartments] = useState<Department[]>([]); // departments 추가

  // Firestore에서 departments 컬렉션 데이터 가져오기 (실시간)
  // State를 부모 컴포넌트에서 관리하여 자식 컴포넌트에 Props로 전달
  useEffect(() => {
    try {
      const q = collection(db, "departments");
      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const deptList: Department[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.name) {
              deptList.push({
                id: doc.id,
                name: data.name,
                type: data.type || "team",
                parentId: data.parentId || undefined,
                createdAt: data.createdAt,
              });
            }
          });
          deptList.sort((a, b) => a.name.localeCompare(b.name)); // 정렬 추가
          setDepartments(deptList);
        },
        (error) => {
          console.error("부서 목록을 불러올 수 없습니다:", error);
          setDepartments([]);
        }
      );
      return () => unsubscribe();
    } catch (error) {
      console.error("부서 목록 쿼리 초기화 실패:", error);
      setDepartments([]);
    }
  }, []);

  // TargetSelector에서 선택값 받기 (useCallback으로 메모이제이션하여 함수 참조 고정)
  const handleTargetChange = useCallback(
    (type: string, value: string | null) => {
      setTargetType(type as "all" | "company" | "team");
      setTargetValue(value);
    },
    []
  ); // 의존성 없음 - 함수 참조 고정

  // Debug Summary 렌더링 함수 (단순화)
  const renderDebugSummary = () => {
    // Case 1: 전체 발송
    if (targetType === "all") {
      return "📢 전체 발송 (모든 사용자)";
    }

    // Case 2: 선택된 대상이 없음
    if (!targetValue) {
      return "🔴 선택된 대상 없음 (targetValue is null)";
    }

    // Case 3: departments가 아직 로드되지 않음
    if (departments.length === 0) {
      return `⚠️ 데이터 로딩 중... (ID: ${targetValue})`;
    }

    // Case 4: 업체별 발송
    if (targetType === "company") {
      // 디버깅: 전체 departments와 targetValue 확인
      console.log("업체 찾기 - 전체 정보:", {
        targetValue,
        targetType,
        departmentsCount: departments.length,
        allDepartments: departments.map((d: Department) => ({
          id: d.id,
          name: d.name,
          type: d.type,
        })),
        companyDepartments: departments
          .filter((d: Department) => d.type === "company")
          .map((d: Department) => ({ id: d.id, name: d.name })),
      });

      const company = departments.find(
        (d: Department) => d.id === targetValue && d.type === "company"
      );

      console.log("업체 찾기 - 결과:", {
        targetValue,
        foundCompany: company,
        matchResult: company ? `✅ 찾음: ${company.name}` : "❌ 못 찾음",
      });

      if (company) {
        return `🏢 업체 발송: ${company.name}`;
      } else {
        return `⚠️ 업체를 찾을 수 없음 (ID: ${targetValue})`;
      }
    }

    // Case 5: 팀별 발송
    if (targetType === "team") {
      // 디버깅: 전체 departments와 targetValue 확인
      console.log("팀 찾기 - 전체 정보:", {
        targetValue,
        targetType,
        departmentsCount: departments.length,
        allDepartments: departments.map((d: Department) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          parentId: d.parentId,
        })),
        teamDepartments: departments
          .filter((d: Department) => d.type === "team")
          .map((d: Department) => ({
            id: d.id,
            name: d.name,
            parentId: d.parentId,
          })),
      });

      const team = departments.find(
        (d: Department) => d.id === targetValue && d.type === "team"
      );

      console.log("팀 찾기 - 결과:", {
        targetValue,
        foundTeam: team,
        matchResult: team ? `✅ 찾음: ${team.name}` : "❌ 못 찾음",
      });

      if (!team) {
        return `⚠️ 팀을 찾을 수 없음 (ID: ${targetValue})`;
      }

      // 팀의 소속 업체 찾기
      if (!team.parentId) {
        return `👷 팀 발송: ${team.name} (소속 업체 정보 없음)`;
      }

      const company = departments.find(
        (d: Department) => d.id === team.parentId
      );
      console.log("소속 업체 찾기:", {
        parentId: team.parentId,
        company,
        matchResult: company ? `✅ 찾음: ${company.name}` : "❌ 못 찾음",
      });

      if (company) {
        return `👷 팀 발송: ${company.name} - ${team.name}`;
      } else {
        return `👷 팀 발송: ${team.name} (소속 업체를 찾을 수 없음)`;
      }
    }

    return "⚠️ 알 수 없는 발송 대상";
  };

  // Target Summary Box 렌더링 함수 (심플한 버전) - 항상 렌더링
  const renderTargetSummary = () => {
    const label = renderDebugSummary();

    // 디버깅: label 값 확인
    console.log("Summary Box 렌더링:", {
      label,
      targetType,
      targetValue,
      departmentsCount: departments.length,
    });

    return (
      <div
        style={{
          border: "2px solid black",
          padding: "12px",
          marginTop: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <span style={{ fontWeight: "bold", fontSize: "14px" }}>{label}</span>
        <button
          onClick={() => {
            setTargetType("all");
            setTargetValue(null);
          }}
          style={{
            padding: "4px 8px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            backgroundColor: "#f3f4f6",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "12px",
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.style.backgroundColor = "#e5e7eb";
          }}
          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.style.backgroundColor = "#f3f4f6";
          }}
        >
          [선택 취소]
        </button>
      </div>
    );
  };

  // [전송하기 버튼] 클릭 시 - 번역과 저장을 한 번에 처리
  const handleSend = async (): Promise<void> => {
    if (!title.trim()) {
      alert("제목을 입력하세요.");
      return;
    }
    if (!originalText) {
      alert("먼저 '한글 공지 내용'을 입력하세요.");
      return;
    }

    // 발송 대상 확인
    let finalTargetValue: string | null = null;
    if (targetType === "company") {
      if (!targetValue) {
        alert("업체를 선택하세요.");
        return;
      }
      finalTargetValue = targetValue;
    } else if (targetType === "team") {
      if (!targetValue) {
        alert("팀을 선택하세요.");
        return;
      }
      finalTargetValue = targetValue;
    }

    // 지속 메시지인 경우 만료일 확인
    if (isPersistent && !expiryDate) {
      alert("지속 메시지의 만료일을 선택하세요.");
      return;
    }

    setIsLoading(true);

    try {
      // 1. 제목과 내용을 각각 번역
      const [titleResult, contentResult] = await Promise.all([
        callTestTranslate({ text: title }),
        callTestTranslate({ text: originalText }),
      ]);

      const titleTranslations = (titleResult as TranslateResponse).data
        .translatedObject;
      const contentTranslations = (contentResult as TranslateResponse).data
        .translatedObject;

      // 2. 만료일 Timestamp 변환
      let expiryTimestamp: Timestamp | undefined = undefined;
      if (isPersistent && expiryDate) {
        const expiryDateObj = new Date(expiryDate);
        expiryDateObj.setHours(23, 59, 59, 999); // 하루 끝 시간으로 설정
        expiryTimestamp = Timestamp.fromDate(expiryDateObj);
      }

      // 3. 번역 결과와 함께 Firestore에 저장
      const bulletinData: any = {
        title: title,
        originalText: originalText,
        titleTranslations: titleTranslations,
        contentTranslations: contentTranslations,
        authorEmail: user.email || "",
        department: finalTargetValue || "", // 하위 호환성
        targetType: targetType,
        targetValue: finalTargetValue,
        isPersistent: isPersistent,
        createdAt: serverTimestamp(),
        status: "sent",
      };

      // expiryDate는 isPersistent가 true이고 expiryTimestamp가 있을 때만 추가
      if (isPersistent && expiryTimestamp) {
        bulletinData.expiryDate = expiryTimestamp;
      }

      await addDoc(collection(db, "bulletins"), bulletinData);

      // 4. 선택된 대상의 사용자들의 "고위험작업" 컬럼에 제목 업데이트
      try {
        let checkInsQuery;
        if (targetType === "all") {
          checkInsQuery = query(collection(db, "authCheckIns"));
        } else {
          checkInsQuery = query(
            collection(db, "authCheckIns"),
            where("department", "==", finalTargetValue)
          );
        }

        const checkInsSnapshot = await getDocs(checkInsQuery);
        const updatePromises: Promise<void>[] = [];

        checkInsSnapshot.forEach((doc) => {
          updatePromises.push(
            updateDoc(doc.ref, {
              highRiskWork: title,
              highRiskWorkUpdatedAt: serverTimestamp(),
            }) as Promise<void>
          );
        });

        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
          console.log(
            `${updatePromises.length}명의 사용자에게 고위험작업 정보가 업데이트되었습니다.`
          );
        }
      } catch (error) {
        console.error("고위험작업 정보 업데이트 오류:", error);
      }

      const targetMessage =
        targetType === "all"
          ? "전체 사용자"
          : targetType === "company"
          ? `'${finalTargetValue}' 업체`
          : `'${finalTargetValue}' 팀`;
      alert(`성공! ${targetMessage}에게 공지가 전송되었습니다.`);
      setIsSent(true);
      setTitle("");
      setOriginalText("");
      setTargetType("all");
      setTargetValue(null);
      setIsPersistent(false);
      setExpiryDate("");
    } catch (error) {
      console.error("전송 오류 상세:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "알 수 없는 오류가 발생했습니다.";
      alert(`전송 실패! (에러: ${errorMessage})`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col overflow-visible"
      style={{
        backgroundColor: DesignTokens.colors.background.default,
        padding: "24px",
        borderRadius: "10px",
        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        border: `1px solid ${DesignTokens.colors.border.default}`,
      }}
    >
      {/* 헤더 영역 */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 24 }}
      >
        <h3
          style={{
            fontSize: 18,
            fontWeight: 500,
            lineHeight: 0,
            color: "#111827",
            margin: 0,
            padding: 0,
          }}
        >
          공지사항 보내기
        </h3>
      </div>

      {/* 발송 대상 설정 영역 - Compact 버전 */}
      <div
        style={{
          padding: "12px",
          marginBottom: 12,
          border: `1px solid ${DesignTokens.colors.border.default}`,
          borderBottom: `2px solid ${DesignTokens.colors.border.dark}`,
          borderRadius: DesignTokens.borderRadius.lg,
          backgroundColor: DesignTokens.colors.background.paper,
        }}
      >
        <h4
          style={{
            ...DesignTokens.typography.bodyMedium,
            fontWeight: 600,
            color: DesignTokens.colors.text.primary,
            marginBottom: 8,
            marginTop: 0,
            lineHeight: 1.2, // 오버라이드: 22 → 1.2
          }}
        >
          발송 대상 설정
        </h4>

        {/* TargetSelector 컴포넌트 */}
        <TargetSelector
          departments={departments}
          onTargetChange={handleTargetChange}
        />

        {/* Target Summary Box - TargetSelector 바로 아래 - 항상 렌더링 */}
        {renderTargetSummary()}

        {/* 지속 메시지 옵션 - 한 줄로 배치 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={isPersistent}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setIsPersistent(e.target.checked);
                if (!e.target.checked) {
                  setExpiryDate("");
                }
              }}
              style={{ cursor: "pointer" }}
            />
            <span
              style={{
                ...DesignTokens.typography.bodySmall,
                lineHeight: 1.2, // 오버라이드: 20 → 1.2
              }}
            >
              📌 지속 메시지 (새벽 초기화 제외)
            </span>
          </label>

          {isPersistent && (
            <>
              <Calendar size={16} color={DesignTokens.colors.text.secondary} />
              <input
                type="date"
                value={expiryDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setExpiryDate(e.target.value)
                }
                min={new Date().toISOString().split("T")[0]}
                style={{
                  height: 28,
                  paddingLeft: 8,
                  paddingRight: 8,
                  fontSize: 13,
                  border: `1px solid ${DesignTokens.colors.border.dark}`,
                  borderRadius: DesignTokens.borderRadius.md,
                  backgroundColor: DesignTokens.colors.background.default,
                  color: DesignTokens.colors.text.primary,
                  lineHeight: 1.0, // 추가
                }}
              />
              <span
                style={{
                  ...DesignTokens.typography.bodySmall,
                  color: DesignTokens.colors.text.secondary,
                  lineHeight: 1.2, // 오버라이드
                }}
              >
                종료일
              </span>
            </>
          )}
        </div>
      </div>

      {/* 입력 영역 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* 제목 입력창 */}
        <textarea
          placeholder="제목을 입력하세요..."
          value={title}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            setTitle(e.target.value)
          }
          disabled={isLoading}
          className="resize-none focus:outline-none"
          style={{
            height: 50,
            minHeight: 0,
            padding: "10px 16px",
            fontSize: 14,
            lineHeight: "normal",
            border: `1px solid ${DesignTokens.colors.border.dark}`,
            borderRadius: 10,
            backgroundColor: DesignTokens.colors.background.default,
            opacity: isLoading ? 0.5 : 1,
            boxSizing: "border-box",
          }}
          onFocus={(e: React.FocusEvent<HTMLTextAreaElement>) => {
            e.currentTarget.style.borderColor =
              DesignTokens.colors.primary.main;
            e.currentTarget.style.boxShadow = `0 0 0 2px ${DesignTokens.colors.primary.light}40`;
          }}
          onBlur={(e: React.FocusEvent<HTMLTextAreaElement>) => {
            e.currentTarget.style.borderColor = DesignTokens.colors.border.dark;
            e.currentTarget.style.boxShadow = "none";
          }}
        />

        {/* 내용 입력창 */}
        <textarea
          placeholder="공지사항 내용을 입력하세요..."
          value={originalText}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            setOriginalText(e.target.value)
          }
          disabled={isLoading}
          className="resize-none focus:outline-none"
          style={{
            minHeight: 300,
            padding: "16px",
            fontSize: 14,
            lineHeight: "normal",
            border: `1px solid ${DesignTokens.colors.border.dark}`,
            borderRadius: 10,
            backgroundColor: DesignTokens.colors.background.default,
            opacity: isLoading ? 0.5 : 1,
            boxSizing: "border-box",
          }}
          onFocus={(e: React.FocusEvent<HTMLTextAreaElement>) => {
            e.currentTarget.style.borderColor =
              DesignTokens.colors.primary.main;
            e.currentTarget.style.boxShadow = `0 0 0 2px ${DesignTokens.colors.primary.light}40`;
          }}
          onBlur={(e: React.FocusEvent<HTMLTextAreaElement>) => {
            e.currentTarget.style.borderColor = DesignTokens.colors.border.dark;
            e.currentTarget.style.boxShadow = "none";
          }}
        />

        {/* 하단 버튼 영역 */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            marginTop: 16,
          }}
        >
          <button
            onClick={handleSend}
            disabled={isLoading || !originalText || !title}
            className="transition-opacity disabled:cursor-not-allowed"
            style={{
              height: DesignTokens.heights.buttonDefault,
              paddingLeft: DesignTokens.buttonPadding.default.horizontal,
              paddingRight: DesignTokens.buttonPadding.default.horizontal,
              paddingTop: DesignTokens.buttonPadding.default.vertical,
              paddingBottom: DesignTokens.buttonPadding.default.vertical,
              ...DesignTokens.typography.bodySmall,
              lineHeight: 0,
              fontWeight: 600,
              borderRadius: DesignTokens.borderRadius.lg,
              backgroundColor: DesignTokens.colors.primary.main,
              color: DesignTokens.colors.text.inverse,
              opacity: isLoading || !originalText || !title ? 0.5 : 1,
              boxSizing: "border-box",
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
              if (!isLoading && originalText && title) {
                e.currentTarget.style.backgroundColor =
                  DesignTokens.colors.primary.dark;
              }
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
              if (!isLoading && originalText && title) {
                e.currentTarget.style.backgroundColor =
                  DesignTokens.colors.primary.main;
              }
            }}
          >
            {isLoading ? "전송 중..." : "전송하기"}
          </button>
        </div>
      </div>

      {isSent && (
        <p
          style={{
            ...DesignTokens.typography.bodySmall,
            lineHeight: 0,
            color: DesignTokens.colors.status.success.text,
            marginTop: DesignTokens.spacing.sm,
          }}
        >
          '공지'가 성공적으로 전송되었습니다!
        </p>
      )}
    </div>
  );
};

export default BulletinDashboard;
