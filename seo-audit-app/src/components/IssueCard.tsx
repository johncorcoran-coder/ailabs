"use client";

import { useState } from "react";

interface Issue {
  id: string;
  pageUrl: string;
  issueType: string;
  severity: string;
  priorityRank: number;
  currentValue: string;
  suggestedValue: string;
  userModifiedValue: string | null;
  status: string;
}

const severityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
};

function formatIssueType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function IssueCard({
  issue,
  onApprove,
  onSkip,
}: {
  issue: Issue;
  onApprove: (issueId: string, value: string) => void;
  onSkip: (issueId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(issue.suggestedValue);

  if (issue.status === "applied") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-green-700">
            #{issue.priorityRank} — {formatIssueType(issue.issueType)}
          </span>
          <span className="text-xs text-green-600">Applied</span>
        </div>
        <p className="mt-1 text-xs text-green-600 truncate">{issue.pageUrl}</p>
      </div>
    );
  }

  if (issue.status === "skipped") {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 opacity-60">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">
            #{issue.priorityRank} — {formatIssueType(issue.issueType)}
          </span>
          <span className="text-xs text-gray-400">Skipped</span>
        </div>
        <p className="mt-1 text-xs text-gray-400 truncate">{issue.pageUrl}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${severityColors[issue.severity] || ""}`}
            >
              {issue.severity}
            </span>
            <span className="text-sm font-semibold text-gray-800">
              #{issue.priorityRank} — {formatIssueType(issue.issueType)}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 truncate">{issue.pageUrl}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <p className="text-xs font-medium text-gray-500">Current</p>
          <p className="mt-0.5 rounded bg-red-50 px-2 py-1 text-sm text-red-800">
            {issue.currentValue || "(empty)"}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Suggested Fix</p>
            <button
              onClick={() => {
                setEditing(!editing);
                setEditValue(issue.suggestedValue);
              }}
              className="text-xs text-indigo-600 hover:underline"
            >
              {editing ? "Cancel edit" : "Edit"}
            </button>
          </div>
          {editing ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={2}
              className="mt-0.5 w-full rounded border border-indigo-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          ) : (
            <p className="mt-0.5 rounded bg-green-50 px-2 py-1 text-sm text-green-800">
              {issue.suggestedValue}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onApprove(issue.id, editing ? editValue : issue.suggestedValue)}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Approve & Apply
        </button>
        <button
          onClick={() => onSkip(issue.id)}
          className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
