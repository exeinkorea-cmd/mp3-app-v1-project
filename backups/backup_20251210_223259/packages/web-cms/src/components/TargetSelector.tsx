import React, { useState, useEffect } from "react";
import { Settings, Check } from "lucide-react";
import GroupManagementModal from "./GroupManagementModal";
import { Department } from "../types";

interface Props {
  departments: Department[]; // 부모로부터 받는 departments 데이터
  onTargetChange: (type: string, value: string | null) => void;
  targetType?: "all" | "company" | "team"; // 부모로부터 받는 targetType (전체발송 상태 확인용)
}

const TargetSelector: React.FC<Props> = ({ departments, onTargetChange, targetType: parentTargetType }) => {
  const [targetType, setTargetType] = useState<"all" | "company" | "team">(
    "company"
  );
  
  // 부모의 targetType이 "all"이면 드롭다운 비활성화
  const isAllSelected = parentTargetType === "all";
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(""); // 업체 ID
  const [selectedTeamName, setSelectedTeamName] = useState<string>(""); // 팀 이름
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // 업체 목록 (type === 'company')
  const companies = departments
    .filter((dept) => dept.type === "company")
    .sort((a, b) => a.name.localeCompare(b.name));

  // 선택된 업체에 소속된 팀 목록
  const teamsInCompany = departments
    .filter(
      (dept) =>
        dept.type === "team" && dept.parentId === selectedCompanyId
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  // targetType 변경 시 선택값 초기화 및 부모에게 알림
  useEffect(() => {
    // targetType이 변경되었을 때만 초기화 (단, "all"로 변경되는 경우는 제외)
    if (targetType !== "all") {
      setSelectedCompanyId("");
      setSelectedTeamName("");
      // "all"이 아닌 경우에만 null로 알림
      if (targetType === "company" || targetType === "team") {
        onTargetChange(targetType, null);
      }
    }
    // eslint-disable-next-line
  }, [targetType]); // onTargetChange는 의도적으로 제외 (함수 참조 변경 방지)

  // 업체/팀 선택은 onChange 핸들러에서 직접 onTargetChange를 호출하므로
  // 별도의 useEffect는 불필요 (targetType 변경 시 초기화는 위의 useEffect에서 처리됨)

  // 업체 선택 시 팀 선택 초기화
  const handleCompanyChange = (companyId: string) => {
    console.log("드롭다운 선택됨 (업체):", companyId); // 디버깅 로그
    
    if (companyId) {
      setSelectedCompanyId(companyId);
      setSelectedTeamName("");
      
      // "전체" 선택 시
      if (companyId === "__ALL__") {
        onTargetChange("all", null);
        // 전체 선택 시에는 드롭다운 초기화 안 함 (선택 상태 유지)
        return;
      }
      
      // 부모에게 알림 (업체별 선택 시에만)
      if (targetType === "company") {
        onTargetChange("company", companyId);
        
        // 업체별 선택 시에만 드롭다운 초기화 (다시 선택 가능하도록)
        setTimeout(() => {
          setSelectedCompanyId("");
        }, 100);
      }
      // 팀별 선택 시에는 업체 선택을 유지 (드롭다운 초기화 안 함)
    } else {
      // 업체 선택 해제
      setSelectedCompanyId("");
      setSelectedTeamName("");
      
      if (targetType === "company") {
        onTargetChange("company", null);
      }
    }
  };

  return (
    <div style={{ width: "100%" }}>
      {/* 라디오 버튼 그룹 */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 8,
          alignItems: "center",
        }}
      >
        {/* "전체 발송" 라디오 버튼 제거 */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
          }}
        >
          <input
            type="radio"
            name="targetType"
            value="company"
            checked={targetType === "company"}
            onChange={(e) => setTargetType(e.target.value as "company")}
          />
          <span style={{ lineHeight: 1.0 }}>업체별</span>
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
          }}
        >
          <input
            type="radio"
            name="targetType"
            value="team"
            checked={targetType === "team"}
            onChange={(e) => setTargetType(e.target.value as "team")}
          />
          <span style={{ lineHeight: 1.0 }}>팀별</span>
        </label>

        {/* Settings 버튼 */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="ml-auto flex items-center gap-1 px-2 py-1 text-sm border rounded hover:bg-gray-100 transition-colors"
          style={{
            borderColor: "#d1d5db",
            color: "#374151",
            marginLeft: "auto",
          }}
        >
          <Settings size={16} />
          <span>관리</span>
        </button>
      </div>

      {/* 업체별 선택 시 - Step 2: 업체 선택 */}
      {targetType === "company" && (
        <div style={{ marginTop: 8 }}>
          <select
            value={selectedCompanyId}
            onChange={(e) => handleCompanyChange(e.target.value)}
            disabled={isAllSelected}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: "#d1d5db",
            }}
          >
            <option value="">업체를 선택하세요</option>
            <option value="__ALL__">📢 전체 발송</option> {/* 전체 옵션 추가 */}
            {companies.length === 0 ? (
              <option disabled>목록이 없습니다</option>
            ) : (
              companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))
            )}
          </select>
          
          {/* 선택된 업체 표시 (시각적 피드백) */}
          {selectedCompanyId && (
            <div className="mt-2 flex items-center gap-2 p-2 bg-blue-100 border border-blue-300 rounded-md">
              <Check size={16} className="text-blue-600" />
              <span className="text-blue-700 font-bold">
                {selectedCompanyId === "__ALL__" 
                  ? "📢 전체 발송" 
                  : companies.find((c) => c.id === selectedCompanyId)?.name}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 팀별 선택 시 - Step 2: 업체 선택, Step 3: 팀 선택 */}
      {targetType === "team" && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Step 2: 업체 선택 */}
          <div>
            <select
              value={selectedCompanyId}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                borderColor: "#d1d5db",
              }}
            >
              <option value="">업체를 먼저 선택하세요</option>
              {companies.length === 0 ? (
                <option disabled>목록이 없습니다</option>
              ) : (
                companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))
              )}
            </select>
            
            {/* 선택된 업체 표시 - 팀이 선택되지 않았을 때만 */}
            {selectedCompanyId && !selectedTeamName && (
              <div className="mt-2 flex items-center gap-2 p-2 bg-blue-100 border border-blue-300 rounded-md">
                <Check size={16} className="text-blue-600" />
                <span className="text-blue-700 font-bold">
                  {companies.find((c) => c.id === selectedCompanyId)?.name}
                </span>
              </div>
            )}
          </div>

          {/* Step 3: 팀 선택 (업체 선택 후 활성화) */}
          <div>
            <select
              value={selectedTeamName}
              onChange={(e) => {
                const teamName = e.target.value;
                console.log("드롭다운 선택됨 (팀):", teamName); // 디버깅 로그
                
                if (teamName) {
                  setSelectedTeamName(teamName);
                  
                  // ✅ 수정: teamsInCompany에서 찾아서 선택된 회사의 팀만 정확히 찾기
                  const team = teamsInCompany.find(
                    (dept) => dept.name === teamName
                  );
                  if (team) {
                    onTargetChange("team", team.id);
                  }
                  
                  // 선택 후 드롭다운 초기화 (다시 선택 가능하도록)
                  setTimeout(() => {
                    setSelectedTeamName("");
                  }, 100);
                } else {
                  onTargetChange("team", null);
                }
              }}
              disabled={!selectedCompanyId || isAllSelected}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: "#d1d5db",
              }}
            >
              <option value="">팀을 선택하세요</option>
              {!selectedCompanyId ? (
                <option disabled>먼저 업체를 선택하세요</option>
              ) : teamsInCompany.length === 0 ? (
                <option disabled>해당 업체에 소속된 팀이 없습니다</option>
              ) : (
                teamsInCompany.map((team) => (
                  <option key={team.id} value={team.name}>
                    {team.name}
                  </option>
                ))
              )}
            </select>
            
            {/* 선택된 팀 표시 - 팀 선택 시 업체명과 팀명 모두 표시 */}
            {selectedTeamName && selectedCompanyId && (
              <div className="mt-2 flex items-center gap-2 p-2 bg-green-100 border border-green-300 rounded-md">
                <Check size={16} className="text-green-600" />
                <span className="text-green-700 font-bold">
                  {companies.find((c) => c.id === selectedCompanyId)?.name} - {selectedTeamName}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 관리 모달 */}
      <GroupManagementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        departments={departments}
      />
    </div>
  );
};

export default TargetSelector;
