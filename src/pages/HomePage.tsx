import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAppState } from "../state/AppState";
import { toCommunitySlug } from "../data/normalize";

type HomePageProps = {
  onOpenAuth: () => void;
  onOpenCreate: () => void;
};

export const HomePage: React.FC<HomePageProps> = ({ onOpenAuth, onOpenCreate }) => {
  const [code, setCode] = useState("");
  const navigate = useNavigate();
  const {
    signedIn,
    memberCommunityCode,
    pendingCommunityCode,
    getCommunity,
    subscribeCommunity,
    isCommunityLoaded,
  } = useAppState();
  const memberCommunity = memberCommunityCode ? getCommunity(memberCommunityCode) : null;
  const pendingCommunity = pendingCommunityCode ? getCommunity(pendingCommunityCode) : null;
  const hasMemberCommunity = Boolean(memberCommunityCode);
  const hasPendingCommunity = Boolean(pendingCommunityCode);
  const isBlocked = hasMemberCommunity || hasPendingCommunity;

  useEffect(() => {
    if (!memberCommunityCode) return;
    return subscribeCommunity(memberCommunityCode);
  }, [memberCommunityCode, subscribeCommunity]);

  useEffect(() => {
    if (!pendingCommunityCode) return;
    return subscribeCommunity(pendingCommunityCode);
  }, [pendingCommunityCode, subscribeCommunity]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const slug = toCommunitySlug(code);
    if (!slug) return;
    navigate(`/${slug}`);
  };

  const renderCta = () => {
    if (isBlocked) return null;
    if (!signedIn) {
      return (
        <button className="button ghost" onClick={onOpenAuth}>
          Sign in to create a community
        </button>
      );
    }

    if (memberCommunityCode && !isCommunityLoaded(memberCommunityCode)) {
      return (
        <button className="button ghost" type="button" disabled>
          Loading your block...
        </button>
      );
    }

    return (
      <button className="button ghost" onClick={onOpenCreate}>
        Create a block
      </button>
    );
  };

  const cta = renderCta();

  return (
    <div className="page home-page">
      <section className="hero hero-home">
        <div className="hero-copy">
          <h1>Your block's private landing page</h1>
          <p className="lead">
            Use a code to open your block page and connect with your neighbors.
          </p>
          {hasMemberCommunity ? (
            <div className="home-primary-cta">
              <div>
                <p className="eyebrow">Your block</p>
                <p className="lead">
                  Jump back into{" "}
                  <strong>{memberCommunity?.name ?? "your block"}</strong>.
                </p>
              </div>
              <Link className="button" to={`/${memberCommunityCode}`}>
                Open {memberCommunityCode}
              </Link>
            </div>
          ) : null}
          {!hasMemberCommunity && hasPendingCommunity ? (
            <div className="home-primary-cta">
              <div>
                <p className="eyebrow">Request pending</p>
                <p className="lead">
                  Waiting on approval for{" "}
                  <strong>{pendingCommunity?.name ?? pendingCommunityCode}</strong>.
                </p>
              </div>
              <Link className="button" to={`/${pendingCommunityCode}`}>
                View {pendingCommunityCode}
              </Link>
            </div>
          ) : null}
          <form className="code-form code-form-home" onSubmit={handleSubmit}>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder={hasMemberCommunity ? "Open another block code" : "Enter block code"}
              aria-label="Block code"
            />
            <button className="button" type="submit">
              {hasMemberCommunity ? "Open another block" : "Open block page"}
            </button>
          </form>
          <div className="home-actions">
            <p className="helper-text">
              Codes are shared neighbor-to-neighbor and are not listed or searchable. Ask a neighbor for your block's code, or sign in to create a community.
            </p>
            <p className="helper-text">
              <a className="home-about-link" href="#about">Don't have a code, but you're curious?</a>
            </p>
            <div className="cta-row">
              <a className="button ghost" href="#about">
                About Our Block
              </a>
              {cta}
            </div>
          </div>
        </div>
      </section>

      <section className="home-explainer" id="about">
        <div className="home-explainer-inner">
          <div className="home-explainer-block">
            <h2>What is Our Block?</h2>
            <p>
              Realistically: it was a fun, exploratory side project that likely isn't going to
              see additional attention. But it is a feature-complete MVP, and everything works!
              Database, auth, reCAPTCHA v3, emails, ability to update passwords, update community
              content, manage community members, the whole shebang.
              If it were looking for users, the pitch would look something like: ... 
            </p>
            <p><i>Every app for local community is broken. Nextdoor optimizes for paranoia,
              complaints, and ads. Facebook groups can be chaotic noise. Meanwhile, the people
              who show up when something happens in your neighborhood are the ones who already
              knew each other. Our Block is a low-friction way to become those people, without
              replacing in-person connection with another feed.
            </i></p>
            <p><i>
              When someone new moves to a block, or an existing resident wants to get more
              involved, there's often no clear entry point.
              <ul>
                <li>How do I join the group text?</li>
                <li>When is the next potluck?</li>
                <li>Is there a tool library?</li>
              </ul>
              That information lives in people's heads and scattered across platforms.
            </i></p>
            <p><i>
              Our Block is a <i>semi</i>-private front door for your neighborhood: a simple page where an
              organizer can collect links, post events, and share contact info. No ads, no feed,
              no optimizing for your attention. Just a place for neighbors to find each other.
            </i></p>
            <Link className="home-try-it" to="/zesty-test">
              Try it: view an example community &rarr;
            </Link>
          </div>
          <div className="home-explainer-block">
            <h2>How it works</h2>
            <ol className="home-how-list">
              <li><strong>Get a code</strong> from a neighbor or community organizer.</li>
              <li><strong>Open your block page</strong> to see resources, events, and how to connect.</li>
              <li><strong>Sign in to create a community</strong> if you want to set one up for your block.</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="home-collab">
        <p>
          Interested in discussing neighborhood tech, mutual aid, or collaborating on
          pro-social tech? Reach out:{" "}
          <span className="home-email">roman.b.grebin [at] gmail.com</span>
        </p>
        <p>
          Source code:{" "}
          <a
            className="home-github-link"
            href="https://github.com/romangrebin/local-block-app"
            target="_blank"
            rel="noreferrer"
          >
            github.com/romangrebin/local-block-app
          </a>
        </p>
        <p>
          For a raw look at the thought process that led to this app, see this{" "} 
          <a className="home-google-doc-link"
            href="https://docs.google.com/document/d/1D77BOXlFiQ1nTf6EDPLFoo3H7Y0to2NpoNSyYWK6KJQ/edit?tab=t.33tcodttxaww"
            target="_blank"
            rel="noreferrer"
          >
             Google Doc where I brainstormed this app (and other ideas)</a>.
        </p>
      </section>
    </div>
  );
};
