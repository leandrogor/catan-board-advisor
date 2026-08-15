import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { UpdateService } from './update.service';

describe('UpdateService', () => {
  let service: UpdateService;
  let versionUpdates$: Subject<VersionReadyEvent>;
  let swUpdateMock: {
    isEnabled: boolean;
    versionUpdates: Subject<VersionReadyEvent>;
    activateUpdate: jasmine.Spy;
    checkForUpdate: jasmine.Spy;
  };

  beforeEach(() => {
    versionUpdates$ = new Subject<VersionReadyEvent>();
    swUpdateMock = {
      isEnabled: true,
      versionUpdates: versionUpdates$,
      activateUpdate: jasmine.createSpy('activateUpdate').and.returnValue(Promise.resolve(true)),
      checkForUpdate: jasmine.createSpy('checkForUpdate').and.returnValue(Promise.resolve(true)),
    };

    TestBed.configureTestingModule({
      providers: [UpdateService, { provide: SwUpdate, useValue: swUpdateMock }],
    });

    service = TestBed.inject(UpdateService);
  });

  it('should be created and default updateAvailable to false', () => {
    expect(service).toBeTruthy();
    expect(service.updateAvailable()).toBeFalse();
  });

  it('should set updateAvailable to true when VERSION_READY event arrives', () => {
    const event: VersionReadyEvent = {
      type: 'VERSION_READY',
      currentVersion: { hash: 'abc' },
      latestVersion: { hash: 'xyz' },
    };

    versionUpdates$.next(event);
    expect(service.updateAvailable()).toBeTrue();
  });

  it('should dismiss update notification', () => {
    service.updateAvailable.set(true);
    service.dismissUpdate();
    expect(service.updateAvailable()).toBeFalse();
  });
});
