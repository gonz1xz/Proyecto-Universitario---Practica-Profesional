import { Navigate, Route, Routes } from 'react-router-dom';
import { SiteLayout } from './components/SiteLayout.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { SearchPage } from './pages/SearchPage.jsx';

export const App = () => (
  <Routes>
    <Route element={<SiteLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/buscar" element={<SearchPage />} />
    </Route>
    <Route path="/iniciar-sesion" element={<LoginPage />} />
    <Route path="/registro" element={<RegisterPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
