import { Component, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { ApplicationState } from '../services/applicationstate';
import { Utilities } from '../services/utilities';
import { relayInit } from 'nostr-tools';
import * as moment from 'moment';
import { DataValidation } from '../services/data-validation';
import { Circle, NostrEvent, NostrProfile, NostrEventDocument, NostrProfileDocument, ProfileStatus } from '../services/interfaces';
import { ProfileService } from '../services/profile';
import { map, Observable, Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { CircleDialog } from '../shared/create-circle-dialog/create-circle-dialog';
import { FollowDialog, FollowDialogData } from '../shared/create-follow-dialog/create-follow-dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NavigationService } from '../services/navigation';
import { ImportFollowDialog, ImportFollowDialogData } from './import-follow-dialog/import-follow-dialog';
import { DataService } from '../services/data';
import { CircleService } from '../services/circle';

@Component({
  selector: 'app-people',
  templateUrl: './people.html',
  styleUrls: ['./people.css'],
})
export class PeopleComponent {
  publicKey?: string | null;
  loading = false;
  showBlocked = false;
  showCached = false;
  showMuted = false;
  showAbout = true;
  showFollowingDate = true;
  following: NostrProfileDocument[] = [];
  items: NostrProfileDocument[] = [];
  sortedItems: NostrProfileDocument[] = [];
  // items$ = this.profileService.items$;

  // sortedItems$ = this.items$.pipe(
  //   map((data) => {
  //     data.sort((a, b) => {
  //       // if (a.name && !b.name) {
  //       //   return -1;
  //       // }

  //       // if (b.name && !a.name) {
  //       //   return 1;
  //       // }

  //       // if (!a.name && !b.name) {
  //       //   return 0;
  //       // }

  //       return a.name?.toLowerCase() < b.name?.toLowerCase() ? -1 : 1;
  //     });

  //     return data;
  //   })
  // );

  selected = 'name-asc';

  searchTerm: any;
  constructor(
    private circleService: CircleService,
    public navigation: NavigationService,
    public appState: ApplicationState,
    private cd: ChangeDetectorRef,
    public dialog: MatDialog,
    public profileService: ProfileService,
    private validator: DataValidation,
    private dataService: DataService,
    public utilities: Utilities,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  // async clearBlocked() {
  //   await this.profileService.clearBlocked();
  //   this.profiles = [];
  //   await this.load();
  // }

  updateSorting() {
    const sorting = this.selected;

    if (sorting === 'name-asc') {
      this.sortedItems = this.items.sort((a, b) => {
        return a.name?.toLowerCase() < b.name?.toLowerCase() ? -1 : 1;
      });
    } else if (sorting === 'name-desc') {
      this.sortedItems = this.items.sort((a, b) => {
        return a.name?.toLowerCase() < b.name?.toLowerCase() ? 1 : -1;
      });
    } else if (sorting === 'followed-asc') {
      this.sortedItems = this.items.sort((a, b) => {
        return a.followed! < b.followed! ? 1 : -1;
      });
    } else if (sorting === 'followed-desc') {
      this.sortedItems = this.items.sort((a, b) => {
        return a.followed! < b.followed! ? -1 : 1;
      });
    } else if (sorting === 'created-asc') {
      this.sortedItems = this.items.sort((a, b) => {
        return a.created_at! < b.created_at! ? -1 : 1;
      });
    } else if (sorting === 'created-desc') {
      this.sortedItems = this.items.sort((a, b) => {
        return a.created_at! < b.created_at! ? 1 : -1;
      });
    }
  }

  optionsUpdated($event: any, type: any) {
    if (type == 1) {
      this.showCached = false;
      this.showMuted = false;
    } else if (type == 2) {
      this.showCached = false;
      this.showBlocked = false;
    } else if (type == 3) {
      this.showBlocked = false;
      this.showMuted = false;
    }

    this.load();
  }

  ngOnDestroy() {
    if (this.sub) {
      this.sub.unsubscribe();
    }
  }

  sub?: Subscription;
  // profiles: NostrProfileDocument[] = [];

  async load() {
    this.loading = true;

    if (this.showBlocked) {
      this.items = await this.profileService.getProfilesByStatus(ProfileStatus.Block);
    } else if (this.showMuted) {
      this.items = await this.profileService.getProfilesByStatus(ProfileStatus.Mute);
    } else if (this.showCached) {
      this.items = await this.profileService.getProfilesByStatus(ProfileStatus.Public);
    } else {
      this.items = this.profileService.following;
    }

    this.updateSorting();

    this.loading = false;
  }

  public trackByFn(index: number, item: NostrProfileDocument) {
    return `${item.pubkey}${item.modified}`;
  }

  async ngOnInit() {
    this.appState.updateTitle('People');
    this.appState.showBackButton = false;
    this.appState.actions = [
      {
        icon: 'person_add',
        tooltip: 'Add a person',
        click: () => {
          this.createFollow();
        },
      },
    ];

    await this.load();

    // TODO: Until we changed to using observable (DataService) for all data,
    // we have this basic observable whenever the profiles changes.
    // this.sub = this.profileService.profilesChanged$.subscribe(async () => {
    //   await this.load();
    // });
  }

  // async search() {
  //   const text: string = this.searchTerm;

  //   // First load the current list.
  //   await this.load();

  //   if (text == 'undefined' || text == null || text == '') {
  //   } else {
  //     this.profiles = this.profiles.filter((item: NostrProfileDocument) => item.name?.indexOf(text) > -1 || item.pubkey?.indexOf(text) > -1 || item.about?.indexOf(text) > -1 || item.nip05?.indexOf(text) > -1);
  //   }
  // }

  getFollowingInCircle(id?: number) {
    if (id == null) {
      return this.following.filter((f) => f.circle == null || f.circle == 0);
    } else {
      return this.following.filter((f) => f.circle == id);
    }
  }

  private getPublicPublicKeys() {
    console.log(this.following);
    const items: string[] = [];

    for (let i = 0; i < this.circleService.circles.length; i++) {
      const circle = this.circleService.circles[i];

      if (circle.public) {
        const profiles = this.getFollowingInCircle(circle.id);
        const pubkeys = profiles.map((p) => p.pubkey);
        items.push(...pubkeys);
      }
    }

    return items;
  }

  async addFollow(pubkey: string) {
    if (pubkey.startsWith('nsec')) {
      let sb = this.snackBar.open('This is a private key, not a public key.', 'Hide', {
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });
      return;
    }

    pubkey = this.utilities.ensureHexIdentifier(pubkey);
    await this.profileService.follow(pubkey);
    // this.feedService.downloadRecent([pubkey]);
  }

  createFollow(): void {
    const dialogRef = this.dialog.open(FollowDialog, {
      data: {},
      maxWidth: '100vw',
      panelClass: 'full-width-dialog',
    });

    dialogRef.afterClosed().subscribe(async (data: FollowDialogData) => {
      if (!data) {
        return;
      }

      let pubkey = data.pubkey;

      pubkey = pubkey.replaceAll('[', '').replaceAll(']', '').replaceAll('"', '');
      const pubkeys = pubkey.split(',');

      for (let i = 0; i < pubkeys.length; i++) {
        await this.addFollow(pubkeys[i]);
      }

      setTimeout(() => {
        this.router.navigate(['/p', pubkeys[0]]);
      }, 100);
    });
  }

  async publishFollowList() {
    const publicPublicKeys = this.getPublicPublicKeys();

    await this.dataService.publishContacts(publicPublicKeys);

    this.snackBar.open(`A total of ${publicPublicKeys.length} was added to your public following list`, 'Hide', {
      duration: 2000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }

  async importFollowList() {
    const dialogRef = this.dialog.open(ImportFollowDialog, {
      data: { pubkey: this.appState.getPublicKey() },
      maxWidth: '100vw',
      panelClass: 'full-width-dialog',
    });

    dialogRef.afterClosed().subscribe(async (result: ImportFollowDialogData) => {
      if (!result) {
        return;
      }

      this.snackBar.open('Importing followers process has started', 'Hide', {
        duration: 2000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });

      let pubkey = this.utilities.ensureHexIdentifier(result.pubkey);

      this.dataService.downloadNewestContactsEvents([pubkey]).subscribe((event) => {
        const nostrEvent = event as NostrEventDocument;
        const publicKeys = nostrEvent.tags.map((t) => t[1]);

        for (let i = 0; i < publicKeys.length; i++) {
          const publicKey = publicKeys[i];

          this.profileService.follow(publicKey);

          // const profile = await this.profile.getProfile(publicKey);

          // // If the user already exists in our database of profiles, make sure we keep their previous circle (if unfollowed before).
          // if (profile) {
          //   await this.profile.follow(publicKeys[i], profile.circle);
          // } else {
          //   await this.profile.follow(publicKeys[i]);
          // }
        }

        // await this.load();

        // this.ngZone.run(() => {
        //   this.cd.detectChanges();
        // });
      });

      // TODO: Add ability to slowly query one after one relay, we don't want to receive multiple
      // follow lists and having to process everything multiple times. Just query one by one until
      // we find the list. Until then, we simply grab the first relay only.
      // this.subscriptions.push(
      //   this.feedService.downloadContacts(pubkey).subscribe(async (contacts) => {
      //     const publicKeys = contacts.tags.map((t) => t[1]);

      //     for (let i = 0; i < publicKeys.length; i++) {
      //       const publicKey = publicKeys[i];
      //       const profile = await this.profile.getProfile(publicKey);

      //       // If the user already exists in our database of profiles, make sure we keep their previous circle (if unfollowed before).
      //       if (profile) {
      //         await this.profile.follow(publicKeys[i], profile.circle);
      //       } else {
      //         await this.profile.follow(publicKeys[i]);
      //       }
      //     }

      //     await this.load();

      //     this.ngZone.run(() => {
      //       this.cd.detectChanges();
      //     });
      //   })
      // );
    });
  }
}
