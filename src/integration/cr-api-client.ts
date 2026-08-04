import { Injectable } from '@angular/core';
import { ChangeRequest, ReqUser } from '../backend/cr.types';
import { CrService } from '../backend/cr-service';
import { CrRepo } from '../backend/cr-repo';
import { buildSeed } from '../backend/seed';
import { BusinessError } from '../backend/errors';
import { CrDetailView } from './cr-view.types';

/**
 * The API/UI boundary. The Angular UI talks to this async client; the client calls the in-process
 * backend `CrService` (built over the seeded repo). This stands in for an HTTP layer — same contract,
 * no network. Business errors thrown by the service surface as rejected promises (the UI shows them).
 *
 * `latencyMs`/`failNext` let the UI exercise loading and error handling.
 */
@Injectable({ providedIn: 'root' })
export class CrApiClient {
	latencyMs = 0;
	failNext = false;
	private readonly service: CrService;

	constructor() {
		const seed = buildSeed();
		const repo = new CrRepo();
		repo.seed(seed.changeRequests);
		this.service = new CrService(repo, seed.agreements, seed.budgets);
	}

	private toDetailView(cr: ChangeRequest): CrDetailView {
		return {
			id: cr.id,
			title: cr.title,
			status: cr.status,
			totals: cr.totals,
			timeline: cr.audit.map((entry) => ({
				action: entry.action,
				byUserId: entry.byUserId,
				at: entry.at,
				note: entry.note,
			})),
		};
	}

	private toClientError(err: unknown): Error {
		if (err instanceof BusinessError) {
			return new Error(err.message);
		}
		return err instanceof Error ? err : new Error('Unexpected error');
	}

	private settle<T>(produce: () => T): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			setTimeout(() => {
				if (this.failNext) {
					this.failNext = false;
					reject(new Error('Network error'));
					return;
				}
				try {
					resolve(produce());
				} catch (err) {
					reject(this.toClientError(err));
				}
			}, this.latencyMs);
		});
	}

	list(user: ReqUser): Promise<ChangeRequest[]> {
		return this.settle(() => this.service.list(user));
	}
	get(user: ReqUser, id: string): Promise<CrDetailView> {
		return this.settle(() => this.toDetailView(this.service.get(user, id)));
	}
	approve(user: ReqUser, id: string, at: string): Promise<CrDetailView> {
		return this.settle(() => this.toDetailView(this.service.approve(user, id, at)));
	}
	reject(user: ReqUser, id: string, at: string, note: string): Promise<CrDetailView> {
		return this.settle(() => this.toDetailView(this.service.reject(user, id, at, note)));
	}
}
