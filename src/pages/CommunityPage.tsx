import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAppState, toCommunitySlug } from "../state/AppState";
import { ManageCommunityModal } from "../components/ManageCommunityModal";

type CommunityPageProps = {
  onOpenAuth: () => void;
  onOpenCreate: () => void;
  openManageOnLoad?: boolean;
};

export const CommunityPage: React.FC<CommunityPageProps> = ({
  onOpenAuth,
  onOpenCreate,
  openManageOnLoad = false,
}) => {
  const params = useParams();
  const navigate = useNavigate();
  const rawCode = params.code ?? "";
  const communityCode = toCommunitySlug(rawCode) || rawCode;
  const displayCode = rawCode.trim() || communityCode || "unknown";
  const {
    signedIn,
    adminCommunityCode,
    getCommunityContent,
    getCommunity,
    isAdminFor,
    communitiesLoaded,
  } = useAppState();

  const [showManage, setShowManage] = useState(openManageOnLoad);
  const community = getCommunity(communityCode);

  const handleManageOpen = () => {
    setShowManage(true);
    navigate(`/${communityCode}/manage`);
  };

  const handleManageClose = () => {
    setShowManage(false);
    navigate(`/${communityCode}`);
  };

  const handleDeleted = () => {
    setShowManage(false);
    navigate("/", { replace: true });
  };

  if (!community && !communitiesLoaded) {
    return (
      <div className="page">
        <div className="card">
          <p className="eyebrow">Loading</p>
          <h2>Fetching community details...</h2>
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

  const isAdmin = signedIn && isAdminFor(communityCode);
  const canCreate = signedIn && !adminCommunityCode;
  const manageBlocked = openManageOnLoad && !isAdmin;

  useEffect(() => {
    if (openManageOnLoad && isAdmin) {
      setShowManage(true);
    }
  }, [openManageOnLoad, isAdmin]);

  return (
    <div className="page">
      <section className="community-header">
        <div>
          <p className="eyebrow">Community code</p>
          <h1>{community.code}</h1>
          <p className="lead">{community.name}</p>
        </div>
        <div className="action-stack">
          {isAdmin ? (
            <button className="button" onClick={handleManageOpen}>
              Manage community
            </button>
          ) : null}
          {canCreate ? (
            <button className="button ghost" onClick={onOpenCreate}>
              Create another community
            </button>
          ) : null}
        </div>
      </section>
      <div className="content-grid">
        <article className="card content-card">
          <p className="eyebrow">Community resources</p>
          <div className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {getCommunityContent(communityCode)}
            </ReactMarkdown>
          </div>
        </article>
        <aside className="card note-card">
          <h3>Keep it neighbor-only</h3>
          <p>
            Codes are shared offline. Encourage new neighbors to ask for the
            code directly.
          </p>
          <div className="divider" />
          <p className="helper-text">
            Signed-in admins can update content, add organizers, or delete the
            community.
          </p>
        </aside>
      </div>
      {manageBlocked ? (
        <div className="card warning-card">
          <p className="eyebrow">Admin access</p>
          <h3>Sign in to manage this community.</h3>
          <p className="helper-text">
            Only admins for {community.code} can edit content or add organizers.
          </p>
          <div className="cta-row">
            <button className="button" onClick={onOpenAuth}>
              Sign in
            </button>
            <Link className="button ghost" to={`/${community.code}`}>
              Back to community
            </Link>
          </div>
        </div>
      ) : null}

      <ManageCommunityModal
        isOpen={showManage && isAdmin}
        onClose={handleManageClose}
        community={community}
        onDeleted={handleDeleted}
      />
    </div>
  );
};
