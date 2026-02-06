import React, { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAppState } from "../state/AppState";
import { toCommunitySlug } from "../data/normalize";

type CommunityPageProps = {
  onOpenCreate: () => void;
};

export const CommunityPage: React.FC<CommunityPageProps> = ({ onOpenCreate }) => {
  const params = useParams();
  const rawCode = params.code ?? "";
  const communityCode = toCommunitySlug(rawCode) || rawCode;
  const displayCode = rawCode.trim() || communityCode || "unknown";
  const {
    signedIn,
    adminCommunityCode,
    getCommunityContent,
    getCommunity,
    isAdminFor,
    subscribeCommunity,
    isCommunityLoaded,
  } = useAppState();

  const community = getCommunity(communityCode);
  const communityLoaded = isCommunityLoaded(communityCode);

  useEffect(() => {
    return subscribeCommunity(communityCode);
  }, [communityCode, subscribeCommunity]);

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

  const isAdmin = signedIn && isAdminFor(communityCode);
  const canCreate = signedIn && !adminCommunityCode;

  return (
    <div className="page">
      <section className="community-header">
        <div>
          <p className="eyebrow">Block code</p>
          <h1>{community.code}</h1>
          <p className="lead">{community.name}</p>
        </div>
        <div className="action-stack">
          {isAdmin ? (
            <Link className="button" to={`/${communityCode}/manage`}>
              Manage block
            </Link>
          ) : null}
          {canCreate ? (
            <button className="button ghost" onClick={onOpenCreate}>
              Create another block
            </button>
          ) : null}
        </div>
      </section>
      <div className="content-grid">
        <article className="card content-card">
          <p className="eyebrow">Block resources</p>
          <div className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {getCommunityContent(communityCode)}
            </ReactMarkdown>
          </div>
        </article>
        <aside className="card note-card">
          <h3>Keep it neighbor-only</h3>
          <p>
            Block codes are shared offline. Encourage neighbors to ask for the
            code directly.
          </p>
          <div className="divider" />
          <p className="helper-text">
            Signed-in admins can update content, add organizers, or delete the
            block page.
          </p>
        </aside>
      </div>
    </div>
  );
};
