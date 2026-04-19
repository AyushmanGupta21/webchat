import { useEffect, useRef, useState } from "react";
import { Calendar, Search, X } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";

const ChatSearchPopup = ({ isOpen, selectedUser, onClose }) => {
  const { searchMessages, setFocusedMessage } = useChatStore();
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const popupRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setDate("");
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onOutsideClick = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !selectedUser?._id) return;

    const hasQuery = Boolean(query.trim() || date);
    if (!hasQuery) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      const nextResults = await searchMessages({
        query,
        date,
        userId: selectedUser._id,
      });

      if (!cancelled) {
        setResults(nextResults);
        setIsSearching(false);
      }
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [date, isOpen, query, searchMessages, selectedUser?._id]);

  if (!isOpen) return null;

  return (
    <div
      ref={popupRef}
      className="absolute right-2 top-[calc(100%+0.35rem)] z-30 w-[min(96vw,420px)] rounded-2xl border border-base-300 bg-base-100 p-3 shadow-2xl"
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold">Search in this chat</h4>
        <button type="button" className="btn btn-ghost btn-xs btn-circle" onClick={onClose}>
          <X className="size-3" />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <label className="input input-bordered input-sm flex items-center gap-2 flex-1">
          <Search className="size-4 text-base-content/60" />
          <input
            type="text"
            className="grow"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search messages"
          />
        </label>

        <label className="btn btn-ghost btn-circle btn-sm" title="Search by date">
          <Calendar className="size-4" />
          <input
            type="date"
            className="hidden"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-xl border border-base-300 bg-base-100">
        {isSearching && <div className="p-3 text-sm text-base-content/70">Searching...</div>}

        {!isSearching && !query.trim() && !date && (
          <div className="p-3 text-sm text-base-content/70">
            Type text or pick a date to find messages in this chat.
          </div>
        )}

        {!isSearching && (query.trim() || date) && results.length === 0 && (
          <div className="p-3 text-sm text-base-content/70">No matching messages found.</div>
        )}

        {!isSearching &&
          results.map((result) => (
            <button
              key={result._id}
              type="button"
              className="w-full border-b border-base-300 last:border-b-0 px-3 py-2 text-left hover:bg-base-200"
              onClick={() => {
                setFocusedMessage(result._id);
                onClose();
              }}
            >
              <div className="truncate text-sm">{result.text || (result.image ? "Media message" : "Message")}</div>
              <div className="text-[11px] text-base-content/60">
                {new Date(result.createdAt).toLocaleString()}
              </div>
            </button>
          ))}
      </div>
    </div>
  );
};

export default ChatSearchPopup;
