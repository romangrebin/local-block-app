import React from "react";
import { Link } from "react-router-dom";
import type { Community } from "../data/models";

type CommunityHeaderProps = {
  community: Community;
  active: "overview" | "manage" | "members";
  showAdminTabs?: boolean;
  pendingCount?: number;
  actions?: React.ReactNode;
};

export const CommunityHeader: React.FC<CommunityHeaderProps> = ({
  community,
  active,
  showAdminTabs = false,
  pendingCount = 0,
  actions,
}) => {
  const showPending = pendingCount > 0;
  return (
    <section className="page-header">
      <div className="page-title">
        <p className="eyebrow">Block</p>
        <h1>{community.name}</h1>
        <p className="lead">Code {community.code}</p>
      </div>
      <div className="page-actions">
        {showAdminTabs ? (
          <div className="page-tabs">
            <Link
              className={`tab-link ${active === "overview" ? "active" : ""}`}
              to={`/${community.code}`}
            >
              Overview
            </Link>
            <Link
              className={`tab-link ${active === "manage" ? "active" : ""}`}
              to={`/${community.code}/manage`}
            >
              Manage
            </Link>
            <Link
              className={`tab-link ${active === "members" ? "active" : ""}`}
              to={`/${community.code}/members`}
            >
              Members
              {showPending ? (
                <span
                  className="tab-badge"
                  aria-label={`${pendingCount} pending request${
                    pendingCount === 1 ? "" : "s"
                  }`}
                >
                  {pendingCount}
                </span>
              ) : null}
            </Link>
          </div>
        ) : null}
        {actions ? <div className="page-commands">{actions}</div> : null}
      </div>
    </section>
  );
};
