import { Navigate, Route, Routes } from 'react-router-dom';
import { SiteLayout } from './components/SiteLayout.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { SearchPage } from './pages/SearchPage.jsx';
import { NotificationsPage } from './pages/NotificationsPage.jsx';
import { FavoritesPage } from './pages/FavoritesPage.jsx';

export const App = () => (
  <Routes>
    <Route element={<SiteLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/buscar" element={<SearchPage />} />
      <Route path="/notificaciones" element={<NotificationsPage />} />
      <Route path="/mis-favoritos" element={<FavoritesPage />} />
    </Route>
    <Route path="/iniciar-sesion" element={<LoginPage />} />
    <Route path="/registro" element={<RegisterPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
