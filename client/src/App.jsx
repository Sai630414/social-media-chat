import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './socket/SocketContext.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import AppLayout from './layouts/AppLayout.jsx';
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'));
const FeedPage = lazy(() => import('./pages/FeedPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const SearchPage = lazy(() => import('./pages/SearchPage.jsx'));
const ChatPage = lazy(() => import('./pages/ChatPage.jsx'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage.jsx'));
const BookmarksPage = lazy(() => import('./pages/BookmarksPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const PostPage = lazy(() => import('./pages/PostPage.jsx'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage.jsx'));
function App() { return <BrowserRouter><AuthProvider><SocketProvider><Suspense fallback={<div className="screen-center"><span className="spinner"/></div>}><Routes><Route path="/login" element={<AuthPage/>}/><Route element={<RequireAuth/>}><Route path="onboarding" element={<OnboardingPage/>}/><Route element={<AppLayout/>}><Route index element={<FeedPage/>}/><Route path="explore" element={<FeedPage explore/>}/><Route path="search" element={<SearchPage/>}/><Route path="profile/:username" element={<ProfilePage/>}/><Route path="post/:id" element={<PostPage/>}/><Route path="messages" element={<ChatPage/>}/><Route path="notifications" element={<NotificationsPage/>}/><Route path="bookmarks" element={<BookmarksPage/>}/><Route path="settings" element={<SettingsPage/>}/><Route path="admin" element={<AdminPage/>}/></Route></Route><Route path="*" element={<AuthPage/>}/></Routes></Suspense></SocketProvider></AuthProvider></BrowserRouter>; }
export default App;
