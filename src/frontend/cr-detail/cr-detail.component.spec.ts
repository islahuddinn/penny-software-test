import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrDetailComponent } from './cr-detail.component';
import { SessionService } from '../../session/session.service';
import { CrApiClient } from '../../integration/cr-api-client';
import { users } from '../../backend/seed';
import { ReqUser } from '../../backend/cr.types';

const flush = () => new Promise((r) => setTimeout(r, 0));

async function render(user: ReqUser, id: string): Promise<ComponentFixture<CrDetailComponent>> {
	TestBed.configureTestingModule({
		imports: [CrDetailComponent],
		providers: [{ provide: SessionService, useValue: { user } }],
	});
	await TestBed.compileComponents();
	const fixture = TestBed.createComponent(CrDetailComponent);
	fixture.componentInstance.id = id;
	fixture.detectChanges(); // ngOnInit -> load()
	await flush();
	fixture.detectChanges();
	return fixture;
}

describe('CrDetailComponent', () => {
	it('loads and renders the change request title', async () => {
		const fixture = await render(users.mona, 'CR-2'); // CR-2 is PENDING_APPROVAL
		expect(fixture.nativeElement.querySelector('.cr-detail__header h2')).not.toBeNull();
	});

	it('disables Approve for a read-only viewer on a pending CR', async () => {
		const fixture = await render(users.viewer, 'CR-2'); // viewer: cr_r_o only
		const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');
		expect(approveBtn.disabled).toBe(true);
	});

	it('hides reject controls for a read-only viewer', async () => {
		const fixture = await render(users.viewer, 'CR-2');
		expect(fixture.nativeElement.querySelector('.cr-actions__reject')).toBeNull();
	});

	it('disables Approve when the CR is not pending approval', async () => {
		const fixture = await render(users.mona, 'CR-APPLIED');
		const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');
		expect(approveBtn.disabled).toBe(true);
	});

	it('enables Approve for an approver on a pending CR', async () => {
		const fixture = await render(users.mona, 'CR-2');
		const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');
		expect(approveBtn.disabled).toBe(false);
	});

	it('approves through the client and updates the rendered status', async () => {
		const fixture = await render(users.mona, 'CR-2');
		const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__approve');
		approveBtn.click();
		fixture.detectChanges();
		await flush();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[data-status="APPROVED"]')).not.toBeNull();
	});

	it('requires a rejection reason before enabling Reject', async () => {
		const fixture = await render(users.mona, 'CR-2');
		const rejectBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__reject-btn');
		expect(rejectBtn.disabled).toBe(true);
		fixture.componentInstance.onReasonInput('Budget impact too high');
		fixture.detectChanges();
		expect(rejectBtn.disabled).toBe(false);
	});

	it('rejects through the client and updates the rendered status', async () => {
		const fixture = await render(users.mona, 'CR-2');
		fixture.componentInstance.onReasonInput('Budget impact too high');
		fixture.detectChanges();
		const rejectBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.cr-actions__reject-btn');
		rejectBtn.click();
		fixture.detectChanges();
		await flush();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[data-status="REJECTED"]')).not.toBeNull();
	});

	it('surfaces action errors when the client fails', async () => {
		const fixture = await render(users.mona, 'CR-2');
		const client = TestBed.inject(CrApiClient);
		client.failNext = true;
		await fixture.componentInstance.approve();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-actions__error')?.textContent).toMatch(/Network error/);
	});
});
