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
    "company"
  );
  // targetValue를 배열로 변경하여 여러 대상 선택 가능
  const [selectedTargets, setSelectedTargets] = useState<Array<{
    id: string;
    name: string;
    type: "company" | "team";
  }>>([]);
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
      if (type === "all") {
        setTargetType("all");
        setSelectedTargets([]);
        return;
      }

      // ✅ 전체발송이 선택되어 있으면 다른 업체/팀 선택 불가
      if (targetType === "all") {
        alert("전체발송이 선택되어 있습니다. 다른 대상을 선택하려면 먼저 전체발송을 해제하세요.");
        return;
      }

      if (!value) return;

      // departments에서 선택된 대상 찾기
      const target = departments.find((d) => d.id === value);
      if (!target) return;

      // 이미 선택된 대상인지 확인
      const isAlreadySelected = selectedTargets.some((t) => t.id === value);
      if (isAlreadySelected) return; // 중복 방지

      // 중복 방지: 업체와 그 소속 팀 동시 선택 방지
      if (type === "company") {
        // 업체 선택 시: 해당 업체에 소속된 모든 팀 제거
        const companyTeams = departments
          .filter((d) => d.type === "team" && d.parentId === value)
          .map((d) => d.id);
        
        setSelectedTargets((prev) => [
          ...prev.filter((t) => !companyTeams.includes(t.id)), // 해당 업체의 팀들 제거
          {
            id: target.id,
            name: target.name,
            type: "company",
          },
        ]);
      } else if (type === "team") {
        // 팀 선택 시: 해당 팀이 속한 업체가 이미 선택되어 있으면 경고
        const parentCompany = departments.find((d) => d.id === target.parentId);
        if (parentCompany) {
          const isCompanySelected = selectedTargets.some(
            (t) => t.id === parentCompany.id && t.type === "company"
          );
          
          if (isCompanySelected) {
            alert(
              `"${parentCompany.name}" 업체가 이미 선택되어 있습니다.\n` +
              `업체를 선택하면 소속된 모든 팀에 발송되므로, 개별 팀 선택이 불필요합니다.`
            );
            return; // 팀 선택 무시
          }
        }

        // 팀 추가
        setSelectedTargets((prev) => [
          ...prev,
          {
            id: target.id,
            name: target.name,
            type: "team",
          },
        ]);
      }
    },
    [departments, selectedTargets, targetType]
  );

  // Debug Summary 렌더링 함수 (단순화)
  const renderDebugSummary = () => {
    // Case 1: 전체 발송
    if (targetType === "all") {
      return "📢 전체 발송 (모든 사용자)";
    }

    // Case 2: 선택된 대상이 없음
    if (selectedTargets.length === 0) {
      return "🔴 선택된 대상 없음";
    }

    // Case 3: departments가 아직 로드되지 않음
    if (departments.length === 0) {
      return "⚠️ 데이터 로딩 중...";
    }

    // Case 4: 단일 대상 선택
    if (selectedTargets.length === 1) {
      const target = selectedTargets[0];
      if (target.type === "company") {
        return `🏢 업체 발송: ${target.name}`;
      } else {
        const team = departments.find((d) => d.id === target.id);
        const company = team?.parentId 
          ? departments.find((d) => d.id === team.parentId)
          : null;
        if (company) {
          return `👷 팀 발송: ${company.name} - ${target.name}`;
        }
        return `👷 팀 발송: ${target.name}`;
      }
    }

    // Case 5: 여러 대상 선택
    const companyCount = selectedTargets.filter((t) => t.type === "company").length;
    const teamCount = selectedTargets.filter((t) => t.type === "team").length;
    
    if (companyCount > 0 && teamCount > 0) {
      return `📢 ${selectedTargets.length}개 대상 발송 (업체 ${companyCount}개, 팀 ${teamCount}개)`;
    } else if (companyCount > 0) {
      return `🏢 ${selectedTargets.length}개 업체 발송`;
    } else {
      return `👷 ${selectedTargets.length}개 팀 발송`;
    }
  };

  // Target Summary Box 렌더링 함수 (심플한 버전) - 항상 렌더링
  const renderTargetSummary = () => {
    const label = renderDebugSummary();

    // targetType이 "all"일 때도 리스트에 표시할 항목
    const allTargetItem = targetType === "all" ? {
      id: "__ALL__",
      name: "전체발송(모든사용자)",
      type: "all" as const,
    } : null;

    // 표시할 항목 목록 (전체발송 + 선택된 대상들)
    const displayItems = allTargetItem 
      ? [allTargetItem, ...selectedTargets]
      : selectedTargets;

    return (
      <div
        style={{
          border: "2px solid black",
          padding: "12px",
          marginTop: "12px",
          borderRadius: "4px",
        }}
      >
        <div style={{ marginBottom: displayItems.length > 0 ? "8px" : "0" }}>
          <span style={{ fontWeight: "bold", fontSize: "14px" }}>{label}</span>
        </div>
        
        {/* 선택된 대상 목록 표시 */}
        {displayItems.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
            {displayItems.map((target) => {
              // 팀인 경우 회사명도 함께 표시
              let displayName = target.name;
              if (target.type === "team") {
                const team = departments.find((d) => d.id === target.id);
                if (team?.parentId) {
                  const company = departments.find((d) => d.id === team.parentId);
                  if (company) {
                    displayName = `${company.name} - ${target.name}`;
                  }
                }
              }

              return (
                <div
                  key={target.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px",
                    backgroundColor: "#f3f4f6",
                    borderRadius: "4px",
                    border: "1px solid #ddd",
                  }}
                >
                  <span style={{ fontSize: "14px" }}>
                    {target.type === "all" 
                      ? "📢" 
                      : target.type === "company" 
                      ? "🏢" 
                      : "👷"} {displayName}
                  </span>
                  <button
                    onClick={() => {
                      if (target.type === "all") {
                        // "전체발송" 삭제 시 targetType을 "company"로 변경
                        setTargetType("company");
                      } else {
                        // 일반 대상 삭제
                        setSelectedTargets((prev) =>
                          prev.filter((t) => t.id !== target.id)
                        );
                      }
                    }}
                    style={{
                      padding: "4px 8px",
                      border: "1px solid #dc2626",
                      borderRadius: "4px",
                      backgroundColor: "#fee2e2",
                      color: "#dc2626",
                      cursor: "pointer",
                      fontWeight: "bold",
                      fontSize: "12px",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#fecaca";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#fee2e2";
                    }}
                  >
                    삭제
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 선택 취소 버튼 */}
        <button
          onClick={() => {
            setTargetType("company"); // "all"이 아닌 "company"로 변경
            setSelectedTargets([]);
          }}
          style={{
            marginTop: "8px",
            padding: "4px 8px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            backgroundColor: "#f3f4f6",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "12px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#e5e7eb";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#f3f4f6";
          }}
        >
          [전체 선택 취소]
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

    // 전체 발송이 아닌 경우 선택된 대상 확인
    if (targetType !== "all" && selectedTargets.length === 0) {
      alert("발송 대상을 선택하세요.");
      return;
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

      // 3. 하나의 공지 생성 (여러 대상 포함)
      const targetValues = selectedTargets.map((t) => t.id);
      
      const bulletinData: any = {
        title: title,
        originalText: originalText,
        titleTranslations: titleTranslations,
        contentTranslations: contentTranslations,
        authorEmail: user.email || "",
        targetType: targetType,
        targetValue: targetType === "all" ? null : (targetValues.length === 1 ? targetValues[0] : null),
        targetValues: targetType === "all" ? null : (targetValues.length > 1 ? targetValues : null),
        isPersistent: isPersistent,
        createdAt: serverTimestamp(),
        status: "sent",
      };

      // expiryDate는 isPersistent가 true이고 expiryTimestamp가 있을 때만 추가
      if (isPersistent && expiryTimestamp) {
        bulletinData.expiryDate = expiryTimestamp;
      }

      await addDoc(collection(db, "bulletins"), bulletinData);

      // 4. 선택된 모든 대상의 사용자들의 "고위험작업" 컬럼에 제목 업데이트 (중복 제거)
      try {
        const allCheckInsMap = new Map<string, { id: string; ref: any }>(); // 중복 제거용 Map

        if (targetType === "all") {
          // 전체 발송
          const checkInsQuery = query(collection(db, "authCheckIns"));
          const checkInsSnapshot = await getDocs(checkInsQuery);
          checkInsSnapshot.forEach((doc) => {
            allCheckInsMap.set(doc.id, { id: doc.id, ref: doc.ref });
          });
        } else {
          // 선택된 대상별로 사용자 조회 (중복 제거)
          for (const target of selectedTargets) {
            const targetDepartment = departments.find((d) => d.id === target.id);
            if (!targetDepartment) continue;

            if (target.type === "company") {
              // 업체의 모든 팀 포함 - department 필드가 "업체명 - 팀명" 형식
              const allCheckInsQuery = query(collection(db, "authCheckIns"));
              const snapshot = await getDocs(allCheckInsQuery);
              snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.department && data.department.startsWith(`${targetDepartment.name} -`)) {
                  // 중복 제거: 같은 사용자 ID는 한 번만 추가
                  if (!allCheckInsMap.has(doc.id)) {
                    allCheckInsMap.set(doc.id, { id: doc.id, ref: doc.ref });
                  }
                }
              });
            } else {
              // 팀별 - department 필드가 "업체명 - 팀명" 형식
              const company = departments.find((d) => d.id === targetDepartment.parentId);
              if (company) {
                const allCheckInsQuery = query(collection(db, "authCheckIns"));
                const snapshot = await getDocs(allCheckInsQuery);
                snapshot.forEach((doc) => {
                  const data = doc.data();
                  if (data.department === `${company.name} - ${targetDepartment.name}`) {
                    // 중복 제거: 같은 사용자 ID는 한 번만 추가
                    if (!allCheckInsMap.has(doc.id)) {
                      allCheckInsMap.set(doc.id, { id: doc.id, ref: doc.ref });
                    }
                  }
                });
              }
            }
          }
        }

        // 모든 사용자 고위험작업 업데이트 (중복 제거된 사용자들)
        const updatePromises: Promise<void>[] = [];
        allCheckInsMap.forEach((checkIn) => {
          updatePromises.push(
            updateDoc(checkIn.ref, {
              highRiskWork: title,
              highRiskWorkUpdatedAt: serverTimestamp(),
            }) as Promise<void>
          );
        });

        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
          console.log(
            `${updatePromises.length}명의 사용자에게 고위험작업 정보가 업데이트되었습니다. (중복 제거됨)`
          );
        }
      } catch (error) {
        console.error("고위험작업 정보 업데이트 오류:", error);
      }

      const targetMessage =
        targetType === "all"
          ? "전체 사용자"
          : `${selectedTargets.length}개 대상 (${selectedTargets.map((t) => t.name).join(", ")})`;
      alert(`성공! ${targetMessage}에게 공지가 전송되었습니다.`);
      
      setIsSent(true);
      setTitle("");
      setOriginalText("");
      setTargetType("all");
      setSelectedTargets([]);
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
          targetType={targetType}
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
