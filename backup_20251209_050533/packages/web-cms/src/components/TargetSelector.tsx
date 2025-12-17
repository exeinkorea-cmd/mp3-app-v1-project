import React, { useState, useEffect } from "react";
import { Settings, Check } from "lucide-react";
import GroupManagementModal from "./GroupManagementModal";
import { Department } from "../types";

interface Props {
  departments: Department[]; // 부모로부터 받는 departments 데이터
  onTargetChange: (type: string, value: string | null) => void;
}

const TargetSelector: React.FC<Props> = ({ departments, onTargetChange }) => {
  const [targetType, setTargetType] = useState<"all" | "company" | "team">(
    "all"
  );
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
    // targetType이 변경되었을 때만 초기화
    setSelectedCompanyId("");
    setSelectedTeamName("");
    onTargetChange(targetType, null);
    // eslint-disable-next-line
  }, [targetType]); // onTargetChange는 의도적으로 제외 (함수 참조 변경 방지)

  // 업체/팀 선택은 onChange 핸들러에서 직접 onTargetChange를 호출하므로
  // 별도의 useEffect는 불필요 (targetType 변경 시 초기화는 위의 useEffect에서 처리됨)

  // 업체 선택 시 팀 선택 초기화
  const handleCompanyChange = (companyId: string) => {
    console.log("드롭다운 선택됨 (업체):", companyId); // 디버깅 로그
    setSelectedCompanyId(companyId);
    setSelectedTeamName("");
    
    // 즉시 부모에게 알림 (useEffect 대신)
    if (targetType === "company" && companyId) {
      onTargetChange("company", companyId);
    } else if (targetType === "company") {
      onTargetChange("company", null);
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
            value="all"
            checked={targetType === "all"}
            onChange={(e) => setTargetType(e.target.value as "all")}
          />
          <span style={{ lineHeight: 1.0 }}>전체 발송</span>
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
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{
              borderColor: "#d1d5db",
            }}
          >
            <option value="">업체를 선택하세요</option>
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
                {companies.find((c) => c.id === selectedCompanyId)?.name}
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
                setSelectedTeamName(teamName);
                
                // 즉시 부모에게 알림 (useEffect 대신)
                if (teamName) {
                  const team = departments.find(
                    (dept) => dept.type === "team" && dept.name === teamName
                  );
                  if (team) {
                    onTargetChange("team", team.id);
                  } else {
                    onTargetChange("team", null);
                  }
                } else {
                  onTargetChange("team", null);
                }
              }}
              disabled={!selectedCompanyId}
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
