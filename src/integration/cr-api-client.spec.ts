import { CrApiClient } from './cr-api-client';
import { users } from '../backend/seed';
import { CrStatus } from '../backend/cr.enums';
import { flush } from '../test-helpers';

describe('CrApiClient', () => {
	it('approves a pending CR end-to-end through the client boundary', async () => {
		const client = new CrApiClient();
		const at = '2026-03-05T10:00:00.000Z';
		const result = await client.approve(users.mona, 'CR-2', at);
		expect(result.status).toBe(CrStatus.APPROVED);
		expect(result.timeline.some((e) => e.action === 'APPROVE' && e.byUserId === 'mona')).toBe(true);
	});

	it('rejects a pending CR end-to-end through the client boundary', async () => {
		const client = new CrApiClient();
		const at = '2026-03-05T10:00:00.000Z';
		const result = await client.reject(users.mona, 'CR-2', at, 'Over budget');
		expect(result.status).toBe(CrStatus.REJECTED);
		expect(result.timeline.some((e) => e.action === 'REJECT' && e.note === 'Over budget')).toBe(true);
	});

	it('translates business errors into plain Error messages for the UI', async () => {
		const client = new CrApiClient();
		await expect(client.approve(users.viewer, 'CR-2', '2026-03-05T10:00:00.000Z')).rejects.toThrow(
			/Cannot approve/,
		);
	});

	it('surfaces network failures via failNext', async () => {
		const client = new CrApiClient();
		client.failNext = true;
		await expect(client.get(users.mona, 'CR-2')).rejects.toThrow(/Network error/);
		expect(client.failNext).toBe(false);
	});

	it('honours latencyMs for async loading behaviour', async () => {
		const client = new CrApiClient();
		client.latencyMs = 20;
		const started = Date.now();
		await client.get(users.mona, 'CR-2');
		expect(Date.now() - started).toBeGreaterThanOrEqual(15);
		await flush();
	});
});
