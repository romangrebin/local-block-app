import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAppState } from "../state/AppState";
import { toCommunitySlug } from "../data/normalize";
import { CommunityHeader } from "../components/CommunityHeader";

type CommunityPageProps = {
  onOpenCreate: () => void;
  onOpenAuth: () => void;
};

export const CommunityPage: React.FC<CommunityPageProps> = ({
  onOpenCreate,
  onOpenAuth,
}) => {
  const params = useParams();
  const rawCode = params.code ?? "";
  const communityCode = toCommunitySlug(rawCode) || rawCode;
  const displayCode = rawCode.trim() || communityCode || "unknown";
  const {
    signedIn,
    memberCommunityCode,
    getCommunityContent,
    getMemberContent,
    getCommunity,
    getMembershipFor,
    requestMembership,
    isMemberFor,
    isAdminFor,
    subscribeCommunity,
    isCommunityLoaded,
  } = useAppState();

  const community = getCommunity(communityCode);
  const communityLoaded = isCommunityLoaded(communityCode);
  const membership = getMembershipFor(communityCode);
  const isAdmin = signedIn && isAdminFor(communityCode);
  const isMember = signedIn && isMemberFor(communityCode);
  const isPending = membership?.status === "pending";
  const [requestError, setRequestError] = useState("");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    return subscribeCommunity(communityCode);
  }, [communityCode, subscribeCommunity]);

  const handleRequestMembership = async () => {
    if (requesting) return;
    setRequesting(true);
    setRequestError("");
    const error = await requestMembership(communityCode);
    if (error) {
      setRequestError(error);
      setRequesting(false);
      return;
    }
    setRequesting(false);
  };

  if (!community && !communityLoaded) {
    return (
      <div className="page">
        <div className="card">
          <p className="eyebrow">Loading</p>
          <h2>Fetching block details...</h2>
          <p className="helper-text">Hang tight while we pull the latest info.</p>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="page">
        <div className="card">
          <p className="eyebrow">Block not found</p>
          <h2>
            Block <code>{displayCode}</code> does not exist - check your
            spelling or check again with your neighbor!
          </h2>
          <p className="helper-text">
            Block pages are private. Double check the code with your
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

  const canCreate = signedIn && !memberCommunityCode;

  return (
    <div className="page">
      <CommunityHeader
        community={community}
        active="overview"
        showAdminTabs={isAdmin}
        actions={
          canCreate ? (
            <button className="button ghost" onClick={onOpenCreate}>
              Create a block
            </button>
          ) : null
        }
      />
      <div className="content-grid">
        <article className="card content-card">
          <p className="eyebrow">Block resources</p>
          <div className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {getCommunityContent(communityCode)}
            </ReactMarkdown>
          </div>
        </article>
        {isMember ? (
          <article className="card member-card">
            <p className="eyebrow">Member-only updates</p>
            <div className="markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {getMemberContent(communityCode)}
              </ReactMarkdown>
            </div>
          </article>
        ) : null}
        <aside className="card note-card">
          <h3>Neighbor verification</h3>
          <p>Members are verified by a block admin.</p>
          <div className="divider" />
          {signedIn ? (
            isAdmin ? (
              <p className="helper-text">
                You are an admin. Review membership requests from the member
                directory.
              </p>
            ) : isMember ? (
              <p className="helper-text">You are a verified member of this block.</p>
            ) : isPending ? (
              <p className="helper-text">Request sent. An admin will review it soon.</p>
            ) : memberCommunityCode && memberCommunityCode !== communityCode ? (
              <p className="helper-text">
                You already belong to <code>{memberCommunityCode}</code>. Members
                can only join one block.
              </p>
            ) : (
              <button
                className="button ghost"
                onClick={handleRequestMembership}
                disabled={requesting}
              >
                {requesting ? "Requesting..." : "Request to join"}
              </button>
            )
          ) : (
            <button className="button ghost" onClick={onOpenAuth}>
              Sign in to request access
            </button>
          )}
          {requestError ? <p className="helper-text error-text">{requestError}</p> : null}
          <div className="divider" />
          <p className="helper-text">
            Block codes are shared offline. Signed-in admins can update content,
            add organizers, or delete the block page.
          </p>
        </aside>
      </div>
    </div>
  );
};
