import React, { useState } from 'react';
import { BookmarkPlus, Check, History, Trash2, X } from 'lucide-react';
import { getStyleById } from '../../data/stylesCatalog';
import { useDesignStore } from '../../store/useDesignStore';

export const VersionHistoryModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { state, dispatch, bom } = useDesignStore();
  const [newName, setNewName] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newName.trim() || `設計方案 v${state.snapshots.length}`;
    dispatch({
      type: 'SAVE_SNAPSHOT',
      name: label,
      summary: `風格：${
        state.present.styleConfig.applied
          ? getStyleById(state.present.styleConfig.selectedStyleId).nameZh
          : '原始材質'
      } · 預估 NT$${Math.round((bom.grandMinTWD + bom.grandMaxTWD) / 2).toLocaleString()}`,
    });
    setNewName('');
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-[#2D3440] bg-[#16191F] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#262B35] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-sky-400" />
            <h2 className="text-sm font-bold text-slate-100">
              設計版本快照與方案比較（Version History）
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSave}
          className="flex items-center gap-2 border-b border-[#262B35] bg-[#12151A] px-5 py-3"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="輸入快照名稱（例如：北歐無主燈＋貓跳台方案）"
            className="flex-1 rounded-lg border border-[#2C3340] bg-[#0E1013] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-[#C89F72] focus:outline-none"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg bg-[#C89F72] px-3.5 py-1.5 text-xs font-bold text-[#111315] hover:bg-[#D8B084] cursor-pointer"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            儲存目前狀態
          </button>
        </form>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-5">
          {state.snapshots.map((snap) => {
            const styleDef = getStyleById(snap.state.styleConfig.selectedStyleId);
            return (
              <div
                key={snap.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#282E39] bg-[#1B1F27] p-3.5"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-100">{snap.name}</span>
                    <span className="font-mono-num text-[10px] text-slate-400">
                      {snap.createdAt}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{snap.summary}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[10.5px]">
                    <span className="rounded bg-[#12151A] px-2 py-0.5 text-slate-300">
                      空間：{snap.state.scene.name}
                    </span>
                    <span className="rounded bg-[#12151A] px-2 py-0.5 text-[#E2BE96]">
                      {snap.state.styleConfig.applied ? styleDef.nameZh : '原始材質'} ·{' '}
                      {snap.state.lighting.kelvin}K
                    </span>
                    <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono-num text-emerald-300">
                      工學 {snap.ergonomicsScore}/100
                    </span>
                    <span className="rounded bg-sky-500/15 px-2 py-0.5 font-mono-num text-sky-300">
                      約 NT$ {snap.estimatedMidTWD.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'RESTORE_SNAPSHOT', id: snap.id });
                      onClose();
                    }}
                    className="flex items-center gap-1 rounded-lg border border-[#C89F72]/50 bg-[#C89F72]/15 px-3 py-1.5 text-xs font-semibold text-[#E2BE96] hover:bg-[#C89F72]/25 cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" />
                    切換至此方案
                  </button>
                  {snap.id !== 'snap-baseline' && (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'DELETE_SNAPSHOT', id: snap.id })}
                      className="rounded-lg border border-[#2C3340] p-1.5 text-slate-400 hover:border-rose-500/50 hover:text-rose-400 cursor-pointer"
                      title="刪除快照"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
