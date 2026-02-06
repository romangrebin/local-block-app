import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AppStateProvider, useAppState } from "./state/AppState";
import { HomePage } from "./pages/HomePage";
import { CommunityPage } from "./pages/CommunityPage";
import { ManageCommunityPage } from "./pages/ManageCommunityPage";
import { MemberDirectoryPage } from "./pages/MemberDirectoryPage";
import { NotFound } from "./pages/NotFound";
import { AuthModal } from "./components/AuthModal";
import { CreateCommunityModal } from "./components/CreateCommunityModal";
import { ConfirmModal } from "./components/ConfirmModal";

const Header: React.FC<{
  onOpenAuth: () => void;
  onOpenCreate: () => void;
  onOpenSignOut: () => void;
}> = ({ onOpenAuth, onOpenCreate, onOpenSignOut }) => {
  const {
    signedIn,
    adminCommunityCode,
    memberCommunityCode,
    userName,
    getCommunity,
  } = useAppState();
  const communityCode = adminCommunityCode ?? memberCommunityCode;
  const community = communityCode ? getCommunity(communityCode) : null;

  return (
    <header className="topbar">
      <div className="brand">
        <Link to="/" className="brand-link">
          Local Block
        </Link>
        <span className="tag">A private landing page for your block</span>
      </div>
      <div className="nav-actions">
        {signedIn ? (
          <div className="user-chip">
            <span>Hi {userName}</span>
            {communityCode ? (
              <Link className="badge link-badge" to={`/${communityCode}`}>
                {adminCommunityCode ? "Admin" : "Member"} of{" "}
                {community?.name ?? communityCode}
              </Link>
            ) : null}
          </div>
        ) : null}
        {signedIn && !memberCommunityCode ? (
          <button className="button ghost" onClick={onOpenCreate}>
            Create block
          </button>
        ) : null}
        {signedIn ? (
          <button className="button" onClick={onOpenSignOut}>
            Sign out
          </button>
        ) : (
          <button className="button" onClick={onOpenAuth}>
            Sign in
          </button>
        )}
      </div>
    </header>
  );
};

const AppShell: React.FC = () => {
  const [showAuth, setShowAuth] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const { signOut } = useAppState();

  return (
    <BrowserRouter>
      <div className="app">
        <Header
          onOpenAuth={() => setShowAuth(true)}
          onOpenCreate={() => setShowCreate(true)}
          onOpenSignOut={() => setShowSignOutConfirm(true)}
        />
        <main>
          <Routes>
            <Route
              path="/"
              element={
                <HomePage
                  onOpenAuth={() => setShowAuth(true)}
                  onOpenCreate={() => setShowCreate(true)}
                />
              }
            />
            <Route
              path="/:code"
              element={
                <CommunityPage
                  onOpenCreate={() => setShowCreate(true)}
                  onOpenAuth={() => setShowAuth(true)}
                />
              }
            />
            <Route
              path="/:code/manage"
              element={
                <ManageCommunityPage onOpenAuth={() => setShowAuth(true)} />
              }
            />
            <Route
              path="/:code/members"
              element={
                <MemberDirectoryPage onOpenAuth={() => setShowAuth(true)} />
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <footer className="footer">
          <p>Local Block MVP. Simple, private, neighbor-led.</p>
        </footer>
      </div>
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
      <CreateCommunityModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
      <ConfirmModal
        isOpen={showSignOutConfirm}
        title="Sign out?"
        description="You can sign back in anytime with your email and password."
        confirmLabel="Sign out"
        destructive
        onCancel={() => setShowSignOutConfirm(false)}
        onConfirm={async () => {
          await signOut();
          setShowSignOutConfirm(false);
        }}
      />
    </BrowserRouter>
  );
};

export const App: React.FC = () => (
  <AppStateProvider>
    <AppShell />
  </AppStateProvider>
);
