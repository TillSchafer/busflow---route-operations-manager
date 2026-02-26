import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const hasCallbackParam = (params: URLSearchParams): boolean =>
  [
    'token',
    'token_hash',
    'code',
    'access_token',
    'refresh_token',
    'type',
    'error',
    'error_code',
    'error_description',
  ].some(key => params.has(key));

const resolveCallbackTarget = (typeParam: string | null): string =>
  typeParam === 'email_change' ? '/auth/account-security' : '/auth/accept-invite';

const AuthCallbackNormalizer = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/auth/accept-invite') return;
    if (location.pathname === '/auth/account-security') return;

    const searchParams = new URLSearchParams(location.search);
    const hashStr = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
    const hashParams = new URLSearchParams(hashStr);

    if (!hasCallbackParam(searchParams) && !hasCallbackParam(hashParams)) {
      return;
    }

    const typeParam = searchParams.get('type') ?? hashParams.get('type');
    const targetPath = resolveCallbackTarget(typeParam);

    navigate(
      { pathname: targetPath, search: location.search, hash: location.hash },
      { replace: true }
    );
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
};

export default AuthCallbackNormalizer;
