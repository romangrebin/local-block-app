import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CommunityHeader } from "../components/CommunityHeader";
import { useAppState } from "../state/AppState";
import { toCommunitySlug } from "../data/normalize";

type MemberDirectoryPageProps = {
  onOpenAuth: () => void;
};

export const MemberDirectoryPage: React.FC<MemberDirectoryPageProps> = ({ onOpenAuth }) => {
  const params = useParams();
  const rawCode = params.code ?? "";
  const communityCode = toCommunitySlug(rawCode) || rawCode;
  const displayCode = rawCode.trim() || communityCode || "unknown";
  const {
    signedIn,
    getCommunity,
    getPendingMembers,
    getActiveMembers,
    approveMembership,
    denyMembership,
    isAdminFor,
    subscribeCommunity,
    isCommunityLoaded,
  } = useAppState();

  const community = getCommunity(communityCode);
  const communityLoaded = isCommunityLoaded(communityCode);
  const isAdmin = signedIn && isAdminFor(communityCode);
  const pendingMembers = getPendingMembers(communityCode);
  const activeMembers = getActiveMembers(communityCode);
  const pendingCount = isAdmin ? pendingMembers.length : 0;

  const [memberError, setMemberError] = useState("");

  useEffect(() => {
    return subscribeCommunity(communityCode);
  }, [communityCode, subscribeCommunity]);

  const handleApproveMember = async (userId: string) => {
    setMemberError("");
    const error = await approveMembership(communityCode, userId);
    if (error) {
      setMemberError(error);
    }
  };

  const handleDenyMember = async (userId: string) => {
    setMemberError("");
    const error = await denyMembership(communityCode, userId);
    if (error) {
      setMemberError(error);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setMemberError("");
    const error = await denyMembership(communityCode, userId);
    if (error) {
      setMemberError(error);
    }
  };

  if (!community && !communityLoaded) {
    return (
      <div className="page">
        <div className="card">
          <p className="eyebrow">Loading</p>
          <h2>Fetching member directory...</h2>
          <p className="helper-text">Hang tight while we pull the latest info.</p>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="page">
        <div className="card">
          <p className="eyebrow">Community not found</p>
          <h2>
            Community <code>{displayCode}</code> does not exist - check your
            spelling or check again with your neighbor!
          </h2>
          <p className="helper-text">
            Community pages are private. Double check the code with your
            neighbor.
          </p>
          <div className="cta-row">
            <Link className="button" to="/">
              Return home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="page manage-page">
        <CommunityHeader
          community={community}
          active="members"
          showAdminTabs={false}
          actions={
            <Link className="button ghost" to={`/${community.code}`}>
              Back to community
            </Link>
          }
        />
        <div className="card warning-card">
          <p className="eyebrow">Admin access</p>
          <h3>Only admins can manage members.</h3>
          <p className="helper-text">
            Sign in with an admin account to approve or remove members.
          </p>
          <div className="cta-row">
            {!signedIn ? (
              <button className="button" onClick={onOpenAuth}>
                Sign in
              </button>
            ) : null}
            <Link className="button ghost" to={`/${community.code}`}>
              Back to community
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <CommunityHeader
        community={community}
        active="members"
        showAdminTabs
        pendingCount={pendingCount}
      />

      <section className="directory-grid">
        <div className="card">
          <p className="section-title">Pending requests</p>
          {pendingMembers.length ? (
            <ul className="request-list">
              {pendingMembers.map((member) => (
                <li key={member.userId}>
                  <span>{member.email}</span>
                  <div className="inline-actions">
                    <button
                      className="button ghost"
                      type="button"
                      onClick={() => handleApproveMember(member.userId)}
                    >
                      Approve
                    </button>
                    <button
                      className="button ghost danger"
                      type="button"
                      onClick={() => handleDenyMember(member.userId)}
                    >
                      Deny
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="helper-text">No pending requests right now.</p>
          )}
          {memberError ? <p className="helper-text error-text">{memberError}</p> : null}
        </div>
        <div className="card">
          <p className="section-title">Active members</p>
          {activeMembers.length ? (
            <ul className="member-list">
              {activeMembers.map((member) => (
                <li key={member.userId}>
                  <span>{member.email}</span>
                  <div className="inline-actions">
                    <span className="badge">
                      {member.role === "admin" ? "Admin" : "Member"}
                    </span>
                    {member.role === "member" ? (
                      <button
                        className="button ghost danger"
                        type="button"
                        onClick={() => handleRemoveMember(member.userId)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="helper-text">No active members yet.</p>
          )}
          <p className="helper-text">
            Members can only belong to one community right now.
          </p>
        </div>
      </section>
    </div>
  );
};
