import { describe, expect, it } from 'vitest';
import { isLastActiveAdmin, slugify } from './admin-ui';
import type { MembershipItem } from '../../../../shared/api/admin/types';

const member: MembershipItem = {
  id: 'm1',
  account_id: 'a1',
  user_id: 'u1',
  role: 'ADMIN',
  status: 'ACTIVE',
  created_at: new Date().toISOString(),
  profiles: null,
};

describe('admin-ui helpers', () => {
  it('slugifies german display text safely', () => {
    expect(slugify('Muster Logistik GmbH')).toBe('muster-logistik-gmbh');
  });

  it('detects last active admin', () => {
    expect(isLastActiveAdmin(member, 1)).toBe(true);
    expect(isLastActiveAdmin(member, 2)).toBe(false);
  });
});
