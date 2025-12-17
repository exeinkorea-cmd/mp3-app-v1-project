import React, { useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { Department } from "../types";
import { X, Plus, Edit2, Trash2, Check } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
}

const GroupManagementModal: React.FC<Props> = ({
  isOpen,
  onClose,
  departments,
}) => {
  const [activeTab, setActiveTab] = useState<"company" | "team">("company");
  const [newName, setNewName] = useState<string>("");
  const [selectedParentId, setSelectedParentId] = useState<string>(""); // 팀 추가 시 선택한 업체 ID
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [editingParentId, setEditingParentId] = useState<string>(""); // 팀 수정 시 업체 ID
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<string | null>(null); // 선택된 항목 ID (시각적 피드백용)

  // 업체 목록
  const companies = departments.filter((dept) => dept.type === "company");

  // 탭별 필터링된 목록
  const filteredList = departments.filter((dept) => dept.type === activeTab);

  // 팀 목록 (소속 업체명 포함)
  const teamsWithCompany = filteredList
    .filter((dept) => dept.type === "team")
    .map((team) => {
      const company = companies.find((c) => c.id === team.parentId);
      return {
        ...team,
        companyName: company?.name || "알 수 없음",
      };
    });

  // 탭 변경 시 초기화
  const handleTabChange = (tab: "company" | "team") => {
    setActiveTab(tab);
    setEditingId(null);
    setNewName("");
    setSelectedParentId("");
    setEditingName("");
    setEditingParentId("");
    setSelectedId(null); // 선택 상태도 초기화
  };

  // 추가 처리
  const handleAdd = async () => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      alert("이름을 입력해주세요.");
      return;
    }

    // 팀인 경우 업체 선택 필수
    if (activeTab === "team" && !selectedParentId) {
      alert("소속 업체를 선택해주세요.");
      return;
    }

    // 중복 체크 (팀인 경우 같은 업체 내에서만)
    let existing;
    if (activeTab === "team") {
      existing = filteredList.find(
        (dept) =>
          dept.name.toLowerCase() === trimmedName.toLowerCase() &&
          dept.parentId === selectedParentId
      );
    } else {
      existing = filteredList.find(
        (dept) => dept.name.toLowerCase() === trimmedName.toLowerCase()
      );
    }

    if (existing) {
      alert(
        `"${trimmedName}" ${activeTab === "company" ? "업체" : "팀"}이 이미 존재합니다.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const data: any = {
        name: trimmedName,
        type: activeTab,
        createdAt: serverTimestamp(),
      };

      // 팀인 경우 parentId 추가
      if (activeTab === "team") {
        data.parentId = selectedParentId;
      }

      await addDoc(collection(db, "departments"), data);
      setNewName("");
      setSelectedParentId("");
      alert(
        `"${trimmedName}" ${activeTab === "company" ? "업체" : "팀"}이 추가되었습니다.`
      );
    } catch (error) {
      console.error("추가 오류:", error);
      alert("추가에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 수정 시작
  const handleStartEdit = (dept: Department) => {
    setEditingId(dept.id);
    setEditingName(dept.name);
    if (dept.type === "team") {
      setEditingParentId(dept.parentId || "");
    }
  };

  // 수정 취소
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingParentId("");
  };

  // 수정 저장
  const handleSaveEdit = async (id: string) => {
    const trimmedName = editingName.trim();
    if (!trimmedName) {
      alert("이름을 입력해주세요.");
      return;
    }

    const dept = departments.find((d) => d.id === id);
    if (!dept) return;

    // 팀인 경우 업체 선택 필수
    if (dept.type === "team" && !editingParentId) {
      alert("소속 업체를 선택해주세요.");
      return;
    }

    // 중복 체크 (자기 자신 제외)
    let existing;
    if (dept.type === "team") {
      existing = filteredList.find(
        (d) =>
          d.id !== id &&
          d.name.toLowerCase() === trimmedName.toLowerCase() &&
          d.parentId === editingParentId
      );
    } else {
      existing = filteredList.find(
        (d) =>
          d.id !== id &&
          d.name.toLowerCase() === trimmedName.toLowerCase()
      );
    }

    if (existing) {
      alert(
        `"${trimmedName}" ${dept.type === "company" ? "업체" : "팀"}이 이미 존재합니다.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData: any = {
        name: trimmedName,
      };

      // 팀인 경우 parentId 업데이트
      if (dept.type === "team") {
        updateData.parentId = editingParentId;
      }

      await updateDoc(doc(db, "departments", id), updateData);
      setEditingId(null);
      setEditingName("");
      setEditingParentId("");
      alert("수정되었습니다.");
    } catch (error) {
      console.error("수정 오류:", error);
      alert("수정에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 삭제 처리 (Cascade Delete with Batch)
  const handleDelete = async (id: string, name: string) => {
    const dept = departments.find((d) => d.id === id);
    if (!dept) return;

    // 업체인 경우 하위 팀 확인
    if (dept.type === "company") {
      const childTeams = departments.filter(
        (team) => team.type === "team" && team.parentId === id
      );

      if (childTeams.length > 0) {
        const confirmMessage = `이 업체를 삭제하면 소속된 ${childTeams.length}개의 팀도 모두 삭제됩니다. 계속하시겠습니까?`;
        if (!window.confirm(confirmMessage)) {
          return;
        }

        // Batch로 업체와 하위 팀 모두 삭제
        setIsSubmitting(true);
        try {
          const batch = writeBatch(db);

          // 업체 문서 삭제
          batch.delete(doc(db, "departments", id));

          // 하위 팀 문서들 삭제
          childTeams.forEach((team) => {
            batch.delete(doc(db, "departments", team.id));
          });

          // Batch 커밋 (원자적 처리)
          await batch.commit();

          alert(
            `업체 "${name}"와 소속된 ${childTeams.length}개의 팀이 삭제되었습니다.`
          );
        } catch (error) {
          console.error("삭제 오류:", error);
          alert("삭제에 실패했습니다. 모든 변경사항이 롤백되었습니다.");
        } finally {
          setIsSubmitting(false);
        }
        return;
      }
    }

    // 팀 삭제 또는 하위 팀이 없는 업체 삭제
    if (
      !window.confirm(
        `정말 "${name}" ${activeTab === "company" ? "업체" : "팀"}을 삭제하시겠습니까?`
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "departments", id));
      alert("삭제되었습니다.");
    } catch (error) {
      console.error("삭제 오류:", error);
      alert("삭제에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#ffffff",
        }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">그룹 관리</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b">
          <button
            onClick={() => handleTabChange("company")}
            className={`flex-1 px-4 py-2 text-center font-medium transition-colors ${
              activeTab === "company"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            업체
          </button>
          <button
            onClick={() => handleTabChange("team")}
            className={`flex-1 px-4 py-2 text-center font-medium transition-colors ${
              activeTab === "team"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            팀
          </button>
        </div>

        {/* 내용 영역 */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* 추가 입력창 */}
          <div className="space-y-2 mb-4">
            {/* 팀 탭인 경우 업체 선택 드롭다운 */}
            {activeTab === "team" && (
              <select
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  borderColor: "#d1d5db",
                }}
              >
                <option value="">소속 업체를 선택하세요</option>
                {companies.length === 0 ? (
                  <option disabled>업체가 없습니다. 먼저 업체를 추가하세요.</option>
                ) : (
                  companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))
                )}
              </select>
            )}

            {/* 이름 입력 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !isSubmitting) {
                    handleAdd();
                  }
                }}
                placeholder={`새 ${activeTab === "company" ? "업체" : "팀"}명 입력`}
                disabled={isSubmitting}
                className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  borderColor: "#d1d5db",
                }}
              />
              <button
                onClick={handleAdd}
                disabled={
                  isSubmitting ||
                  !newName.trim() ||
                  (activeTab === "team" && !selectedParentId)
                }
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                <Plus size={16} />
                <span>추가</span>
              </button>
            </div>
          </div>

          {/* 리스트 */}
          <div className="space-y-2">
            {activeTab === "company" ? (
              // 업체 리스트
              filteredList.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  업체 목록이 비어있습니다.
                </div>
              ) : (
                filteredList.map((dept) => (
                  <div
                    key={dept.id}
                    onClick={() => setSelectedId(dept.id)}
                    className={`flex items-center gap-2 p-3 border rounded-md transition-colors cursor-pointer ${
                      selectedId === dept.id
                        ? "bg-blue-100 border-blue-300"
                        : "hover:bg-gray-50"
                    }`}
                    style={{
                      borderColor:
                        selectedId === dept.id ? "#93c5fd" : "#e5e7eb",
                    }}
                  >
                    {editingId === dept.id ? (
                      <>
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === "Enter") {
                              handleSaveEdit(dept.id);
                            } else if (e.key === "Escape") {
                              handleCancelEdit();
                            }
                          }}
                          className="flex-1 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{
                            borderColor: "#d1d5db",
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit(dept.id)}
                          disabled={isSubmitting}
                          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
                        >
                          저장
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={isSubmitting}
                          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 transition-colors"
                        >
                          취소
                        </button>
                      </>
                    ) : (
                      <>
                        <span
                          className={`flex-1 ${
                            selectedId === dept.id
                              ? "text-blue-700 font-bold"
                              : ""
                          }`}
                        >
                          {dept.name}
                        </span>
                        {selectedId === dept.id && (
                          <Check size={16} className="text-blue-600" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(dept);
                          }}
                          disabled={isSubmitting}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(dept.id, dept.name);
                          }}
                          disabled={isSubmitting}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                ))
              )
            ) : (
              // 팀 리스트 (소속 업체명 포함)
              teamsWithCompany.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  팀 목록이 비어있습니다.
                </div>
              ) : (
                teamsWithCompany.map((team) => (
                  <div
                    key={team.id}
                    onClick={() => setSelectedId(team.id)}
                    className={`flex items-center gap-2 p-3 border rounded-md transition-colors cursor-pointer ${
                      selectedId === team.id
                        ? "bg-blue-100 border-blue-300"
                        : "hover:bg-gray-50"
                    }`}
                    style={{
                      borderColor:
                        selectedId === team.id ? "#93c5fd" : "#e5e7eb",
                    }}
                  >
                    {editingId === team.id ? (
                      <>
                        <select
                          value={editingParentId}
                          onChange={(e) => setEditingParentId(e.target.value)}
                          disabled={isSubmitting}
                          className="px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{
                            borderColor: "#d1d5db",
                          }}
                        >
                          <option value="">업체 선택</option>
                          {companies.map((company) => (
                            <option key={company.id} value={company.id}>
                              {company.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === "Enter") {
                              handleSaveEdit(team.id);
                            } else if (e.key === "Escape") {
                              handleCancelEdit();
                            }
                          }}
                          className="flex-1 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{
                            borderColor: "#d1d5db",
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit(team.id)}
                          disabled={isSubmitting}
                          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
                        >
                          저장
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={isSubmitting}
                          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 transition-colors"
                        >
                          취소
                        </button>
                      </>
                    ) : (
                      <>
                        <span
                          className={`flex-1 ${
                            selectedId === team.id
                              ? "text-blue-700 font-bold"
                              : ""
                          }`}
                        >
                          {team.name}{" "}
                          <span className="text-gray-500">
                            ({team.companyName})
                          </span>
                        </span>
                        {selectedId === team.id && (
                          <Check size={16} className="text-blue-600" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(team);
                          }}
                          disabled={isSubmitting}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(team.id, team.name);
                          }}
                          disabled={isSubmitting}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupManagementModal;
