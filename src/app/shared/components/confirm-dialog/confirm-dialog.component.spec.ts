import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ConfirmDialogComponent } from './confirm-dialog.component';

@Component({
  imports: [ConfirmDialogComponent],
  template: `
    <app-confirm-dialog
      [icon]="icon()"
      [title]="title()"
      [message]="message()"
      [confirmText]="confirmText()"
      [cancelText]="cancelText()"
      [variant]="variant()"
      [closeOnBackdrop]="closeOnBackdrop()"
      (confirmed)="onConfirmed()"
      (cancelled)="onCanceled()"
    />
  `,
})
class TestHostComponent {
  readonly icon = signal('⏱');
  readonly title = signal('Test Title');
  readonly message = signal('Test Message');
  readonly confirmText = signal('Confirm');
  readonly cancelText = signal<string | null>('Cancel');
  readonly variant = signal<'primary' | 'danger'>('primary');
  readonly closeOnBackdrop = signal(true);

  confirmedCalled = false;
  canceledCalled = false;

  onConfirmed(): void {
    this.confirmedCalled = true;
  }

  onCanceled(): void {
    this.canceledCalled = true;
  }
}

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, ConfirmDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and render title, message, and icon', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#dialog-title')?.textContent?.trim()).toBe('Test Title');
    expect(el.querySelector('#dialog-desc')?.textContent?.trim()).toBe('Test Message');
    expect(el.textContent).toContain('⏱');
  });

  it('should emit confirm output on confirm button click', () => {
    const confirmBtn: HTMLButtonElement =
      fixture.nativeElement.querySelector('#dialog-confirm-btn');
    expect(confirmBtn).toBeTruthy();
    expect(confirmBtn.textContent?.trim()).toBe('Confirm');

    confirmBtn.click();
    expect(host.confirmedCalled).toBeTrue();
  });

  it('should emit cancel output on cancel button click', () => {
    const cancelBtn: HTMLButtonElement = fixture.nativeElement.querySelector('#dialog-cancel-btn');
    expect(cancelBtn).toBeTruthy();
    expect(cancelBtn.textContent?.trim()).toBe('Cancel');

    cancelBtn.click();
    expect(host.canceledCalled).toBeTrue();
  });

  it('should emit cancel on backdrop click when closeOnBackdrop is true', () => {
    const backdrop: HTMLElement = fixture.nativeElement.querySelector('[role="dialog"]');
    backdrop.click();
    expect(host.canceledCalled).toBeTrue();
  });

  it('should not emit cancel on backdrop click when closeOnBackdrop is false', () => {
    host.closeOnBackdrop.set(false);
    fixture.detectChanges();

    const backdrop: HTMLElement = fixture.nativeElement.querySelector('[role="dialog"]');
    backdrop.click();
    expect(host.canceledCalled).toBeFalse();
  });

  it('should not emit cancel when clicking modal card container', () => {
    const card: HTMLElement = fixture.nativeElement.querySelector('.bg-\\[\\#faf8f3\\]')!;
    card.click();
    expect(host.canceledCalled).toBeFalse();
  });

  it('should emit cancel on window Escape keydown', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.canceledCalled).toBeTrue();
  });

  it('should apply danger classes when variant is danger', () => {
    host.variant.set('danger');
    fixture.detectChanges();

    const confirmBtn: HTMLButtonElement =
      fixture.nativeElement.querySelector('#dialog-confirm-btn');
    expect(confirmBtn.className).toContain('bg-rose-600');
  });

  it('should apply primary indigo classes when variant is primary', () => {
    host.variant.set('primary');
    fixture.detectChanges();

    const confirmBtn: HTMLButtonElement =
      fixture.nativeElement.querySelector('#dialog-confirm-btn');
    expect(confirmBtn.className).toContain('bg-indigo-600');
  });

  it('should not render cancel button when cancelText is null', () => {
    host.cancelText.set(null);
    fixture.detectChanges();

    const cancelBtn = fixture.nativeElement.querySelector('#dialog-cancel-btn');
    expect(cancelBtn).toBeNull();
  });
});
