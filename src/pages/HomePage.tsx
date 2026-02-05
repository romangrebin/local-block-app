import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toCommunitySlug, useAppState } from "../state/AppState";

type HomePageProps = {
  onOpenAuth: () => void;
  onOpenCreate: () => void;
};

export const HomePage: React.FC<HomePageProps> = ({ onOpenAuth, onOpenCreate }) => {
  const [code, setCode] = useState("");
  const navigate = useNavigate();
  const {
    signedIn,
    adminCommunityCode,
    getCommunity,
    subscribeCommunity,
    isCommunityLoaded,
    firebaseEnabled,
  } = useAppState();
  const adminCommunity = adminCommunityCode ? getCommunity(adminCommunityCode) : null;

  useEffect(() => {
    if (!adminCommunityCode) return;
    return subscribeCommunity(adminCommunityCode);
  }, [adminCommunityCode, subscribeCommunity]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const slug = toCommunitySlug(code);
    if (!slug) return;
    navigate(`/${slug}`);
  };

  const renderCta = () => {
    if (!signedIn) {
      return (
        <button className="button ghost" onClick={onOpenAuth}>
          Sign up to create your own
        </button>
      );
    }

    if (adminCommunityCode && !isCommunityLoaded(adminCommunityCode)) {
      return (
        <button className="button ghost" type="button" disabled>
          Loading your community...
        </button>
      );
    }

    if (adminCommunityCode) {
      return (
        <Link className="button ghost" to={`/${adminCommunityCode}`}>
          Go to {adminCommunity?.name ?? "your community"}
        </Link>
      );
    }

    return (
      <button className="button ghost" onClick={onOpenCreate}>
        Create new community
      </button>
    );
  };

  return (
    <div className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Private neighborhood front doors</p>
          <h1>Local Block</h1>
          <p className="lead">
            Enter a community code to reach your neighborhood landing page with
            chats, events, and organizer info.
          </p>
          <form className="code-form" onSubmit={handleSubmit}>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Enter community code"
              aria-label="Community code"
            />
            <button className="button" type="submit">
              Open community
            </button>
          </form>
          <p className="helper-text">
            Community codes are shared neighbor-to-neighbor and are not indexed
            publicly.
          </p>
        </div>
        <div className="card showcase">
          {!firebaseEnabled ? (
            <>
              <h3>Demo communities</h3>
              <p>Use these sample codes to explore the MVP.</p>
              <div className="pill-row">
                <Link className="pill" to="/maple-hill">
                  maple-hill
                </Link>
                <Link className="pill" to="/citrus-park">
                  citrus-park
                </Link>
              </div>
            </>
          ) : (
            <>
              <h3>Need a community code?</h3>
              <p>
                Codes are shared neighbor-to-neighbor. Ask someone nearby or
                create a new community to get started.
              </p>
            </>
          )}
          <div className="cta-row">{renderCta()}</div>
        </div>
      </section>
    </div>
  );
};
