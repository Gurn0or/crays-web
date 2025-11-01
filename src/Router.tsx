import { Component, lazy } from 'solid-js';
import { Router, Route, Navigate, cache } from "@solidjs/router";
import { PrimalWindow } from './types/primal';
import { fetchKnownProfiles } from './lib/profile';
import { useHomeContext } from './contexts/HomeContext';
import { useExploreContext } from './contexts/ExploreContext';
import { useThreadContext } from './contexts/ThreadContext';
import { useAccountContext } from './contexts/AccountContext';
import { useProfileContext } from './contexts/ProfileContext';
import { useSettingsContext } from './contexts/SettingsContext';
import { useMediaContext } from './contexts/MediaContext';
import { useNotificationsContext } from './contexts/NotificationsContext';
import { useSearchContext } from './contexts/SearchContext';
import { useDMContext } from './contexts/DMContext';
import { generateNsec, nip19 } from './lib/nTools';
import Blossom from './pages/Settings/Blossom';
import CryptoRedirect from './components/CryptoRedirect';

const Home = lazy(() => import('./pages/Home'));
const Reads = lazy(() => import('./pages/Reads'));
const Layout = lazy(() => import('./components/Layout/Layout'));
// const Explore = lazy(() => import('./pages/Explore'));
const Explore = lazy(() => import('./pages/Explore/Explore'));
const ExploreFeeds = lazy(() => import('./pages/Explore/ExploreFeeds'));
const Thread = lazy(() => import('./pages/Thread'));
const DirectMessages = lazy(() => import('./pages/DirectMessages'));
const Bookmarks = lazy(() => import('./pages/Bookmarks'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Downloads = lazy(() => import('./pages/Downloads'));
const Settings = lazy(() => import('./pages/Settings/Settings'));
const Help = lazy(() => import('./pages/Help'));
const Search = lazy(() => import('./pages/Search'));
const NotFound = lazy(() => import('./pages/NotFound'));
const EditProfile = lazy(() => import('./pages/EditProfile'));
const Profile = lazy(() => import('./pages/Profile'));
const Mutelist = lazy(() => import('./pages/Mutelist'));
const CreateAccount = lazy(() => import('./pages/CreateAccount')); 

const NotifSettings = lazy(() => import('./pages/Settings/Notifications'));
const Account = lazy(() => import('./pages/Settings/Account'));
const HomeFeeds = lazy(() => import('./pages/Settings/HomeFeeds'));
const ReadsFeeds = lazy(() => import('./pages/Settings/ReadsFeeds'));
const ZapSettings = lazy(() => import('./pages/Settings/Zaps'));
const Muted = lazy(() => import('./pages/Settings/Muted'));
const Network = lazy(() => import('./pages/Settings/Network'));
const Moderation = lazy(() => import('./pages/Settings/Moderation'));
const NostrWalletConnect = lazy(() => import('./pages/Settings/NostrWalletConnect'));
const Menu = lazy(() => import('./pages/Settings/Menu'));
// const Landing = lazy(() => import('./pages/Landing'));
const AppDownloadQr = lazy(() => import('./pages/appDownloadQr'));
const Feeds = lazy(() => import('./pages/Feeds'));
const Feed = lazy(() => import('./pages/Feed'));
const AdvancedSearch = lazy(() => import('./pages/AdvancedSearch'));
const AdvancedSearchResults = lazy(() => import('./pages/AdvancedSearchResults'));
const Streaming = lazy(() => import('./pages/StreamPage'));
const CitadelPage = lazy(() => import('./pages/citadelstream'));
const Wallet = lazy(() => import('./pages/Wallet'));

declare global {
  interface Window extends PrimalWindow {}
}

const getKnownProfiles = cache(fetchKnownProfiles, 'knownProfiles');

const AppRouter: Component = () => {
  return (
    <Router root={Layout}>
      <Route path="/" component={Home} />
      <Route path="/app-download-qr" component={AppDownloadQr} />
      <Route path="/reads" component={Reads} />
      <Route path="/explore" component={Explore} />
      <Route path="/explore/feed" component={ExploreFeeds} />
      <Route path="/e/:noteId" component={Thread} />
      <Route path="/messages" component={DirectMessages} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/downloads" component={Downloads} />
      <Route path="/download" component={() => <Navigate href='/downloads' />} />;
      <Route path="/wallet" component={Wallet} />
      <Route path="/settings" component={Settings}>
        <Route path="/" component={Menu} />
        <Route path="/account" component={Account} />
        <Route path="/home_feeds" component={HomeFeeds} />
        <Route path="/reads_feeds" component={ReadsFeeds} />
        <Route path="/notifications" component={NotifSettings} />
        <Route path="/zaps" component={ZapSettings} />
        <Route path="/muted" component={Muted} />
        <Route path="/network" component={Network} />
        <Route path="/filters" component={Moderation} />
        <Route path="/nwc" component={NostrWalletConnect} />
        <Route path="/uploads" component={Blossom} />
      </Route>
      <Route path="/bookmarks" component={Bookmarks} />
      <Route path="/settings/profile" component={EditProfile} />
      <Route path="/profile/:npub?" component={Profile} />
      <Route path="/p/:npub?">
        <Route path="/" component={Profile} />
        <Route path="/live/streamId?" component={Streaming} />
      </Route>
      <Route path="/help" component={Help} />
      {/* <Route path="/search/:query" component={Search} /> */}
      {/* <Route path="/rest/*" component={Explore} /> */}
      <Route path="/mutelist/:npub" component={Mutelist} />
      <Route path="/new" component={CreateAccount} />
      <Route path="/feeds">
        <Route path="/" component={Feeds} />
        <Route path="/:query" component={Feed} />
      </Route>
      <Route path="/search">
        <Route path="/" component={AdvancedSearch} />
        <Route path="/:query" component={AdvancedSearchResults} />
      </Route>
      <Route path="/Cryptonomicon" component={CryptoRedirect} />
      <Route path="/:vanityName">
        <Route path="/" component={Profile} preload={getKnownProfiles} />
        <Route path="/live/:streamId?" component={Streaming} />
        <Route path="/:identifier" component={Thread} preload={getKnownProfiles} />
      </Route>
      <Route path="/rc/:code?" component={() => <Navigate href='/app-download-qr' />}/>
      <Route path="/citadel_stream" component={CitadelPage} />
      <Route path="/404" component={NotFound} />
    </Router>
  );
};

export default AppRouter;
