// Shared test fixtures — imported by individual route test files.
// Not a test file itself (no describe/it blocks).

const now = new Date();

export const managerA = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  clerkUserId: 'clerk-user-a',
  orgId: 'org-id',
  deptId: 'dept-id',
  role: 'manager' as const,
  name: 'Manager A',
  email: 'a@test.com',
  createdAt: now,
  updatedAt: now,
};

export const managerB = {
  ...managerA,
  id: 'bbbbbbbb-0000-0000-0000-000000000002',
  clerkUserId: 'clerk-user-b',
  name: 'Manager B',
};

export const hrAdmin = {
  ...managerA,
  id: 'cccccccc-0000-0000-0000-000000000003',
  clerkUserId: 'clerk-user-hr',
  role: 'hr_admin' as const,
  name: 'HR Admin',
};
