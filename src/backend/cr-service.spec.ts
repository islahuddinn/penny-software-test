import { buildApp, T } from '../test-helpers';
import { CrStatus } from './cr.enums';
import { BusinessError } from './errors';
import { ChangeRequest } from './cr.types';

describe('CrService', () => {
	describe('approve', () => {
		it('transitions PENDING_APPROVAL -> APPROVED and records approval + audit', () => {
			const { service, users } = buildApp();
			const result = service.approve(users.mona, 'CR-2', T);
			expect(result.status).toBe(CrStatus.APPROVED);
			expect(result.approvals).toEqual([{ userId: 'mona', action: 'APPROVE', at: T }]);
			expect(result.audit.some((e) => e.action === 'APPROVE')).toBe(true);
		});

		it('rejects approve without an approve policy', () => {
			const { service, users } = buildApp();
			expect(() => service.approve(users.viewer, 'CR-2', T)).toThrow(BusinessError);
		});

		it('rejects illegal transition (DRAFT -> APPROVED via approve on draft CR)', () => {
			const { service, users } = buildApp();
			expect(() => service.approve(users.mona, 'CR-1', T)).toThrow(/illegal|not allowed/i);
		});
	});

	describe('apply', () => {
		it('consumes budget for a positive delta and sets APPLIED', () => {
			const { service, users, budgets } = buildApp();
			const approved = service.approve(users.mona, 'CR-2', T);
			const budgetBefore = budgets.get('BUD-1')!.balance;
			const result = service.apply(users.mona, approved.id, T);
			expect(result.status).toBe(CrStatus.APPLIED);
			expect(budgets.get('BUD-1')!.balance).toBe(budgetBefore - result.totals.delta);
			expect(result.audit.some((e) => e.action === 'APPLY')).toBe(true);
		});

		it('rejects apply when budget cannot cover a positive delta', () => {
			const { service, users, repo, agreements, budgets } = buildApp();
			const lowBudgetCr: ChangeRequest = {
				id: 'CR-LOW',
				orgCode: 'org-alpha',
				agreementId: 'AGR-1',
				createdBy: 'alice',
				title: 'Over budget change',
				status: CrStatus.APPROVED,
				draftChanges: {
					lineItems: [
						{ sku: 'SKU-A', description: 'Widget A', quantity: 100, unitPrice: 500 },
						{ sku: 'SKU-B', description: 'Widget B', quantity: 30, unitPrice: 100 },
					],
				},
				totals: { baselineTotal: 8000, newTotal: 53000, delta: 45000 },
				approvals: [],
				version: 2,
				audit: [],
			};
			repo.seed([lowBudgetCr]);
			agreements.set('AGR-1', { ...agreements.get('AGR-1')!, budgetId: 'BUD-LOW' });
			expect(() => service.apply(users.mona, 'CR-LOW', T)).toThrow(/budget/i);
			expect(budgets.get('BUD-LOW')!.balance).toBe(100);
		});

		it('rejects apply without an apply policy', () => {
			const { service, users } = buildApp();
			service.approve(users.mona, 'CR-2', T);
			const readOnly = { ...users.viewer, policies: ['cr_r_o'] };
			expect(() => service.apply(readOnly, 'CR-2', T)).toThrow(BusinessError);
		});
	});
});
