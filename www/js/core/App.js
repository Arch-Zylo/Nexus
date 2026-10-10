import { Store } from './Store.js';
import { Toast } from './Toast.js';
import { OverlayManager } from './OverlayManager.js';
import { ThemeManager } from './ThemeManager.js';
import { ModeManager } from './ModeManager.js';
import { BottomSheet } from './BottomSheet.js';
import { Dialog } from './Dialog.js';
import { TermsGate } from './TermsGate.js';
import { AppLock } from './AppLock.js';
import { Greeter } from './Greeter.js';
import { GreetingPanel } from '../features/regular/GreetingPanel.js';
import { ProfileView } from '../features/regular/ProfileView.js';
import { Shell } from './Shell.js';
import { NotificationService } from './NotificationService.js';
import { MediaDB } from '../storage/MediaDB.js';
import { BackupService } from '../storage/BackupService.js';
import { Thumbnails } from '../media/Thumbnails.js';
import { SpendingService } from '../features/regular/SpendingService.js';
import { HomeView } from '../features/regular/HomeView.js';
import { TimetableView } from '../features/regular/TimetableView.js';
import { EventsView } from '../features/regular/EventsView.js';
import { TasksView } from '../features/regular/TasksView.js';
import { PeopleView } from '../features/regular/PeopleView.js';
import { NotesView } from '../features/regular/NotesView.js';
import { WalletView } from '../features/regular/WalletView.js';
import { PasswordsView } from '../features/regular/PasswordsView.js';
import { SettingsView } from '../features/regular/SettingsView.js';
import { ChillHome } from '../features/chill/ChillHome.js';
import { MediaImporter } from '../features/chill/MediaImporter.js';
import { MusicLibrary } from '../features/chill/MusicLibrary.js';
import { AudioPlayer } from '../features/chill/AudioPlayer.js';
import { NowPlaying } from '../features/chill/NowPlaying.js';
import { VideoPlayer } from '../features/chill/VideoPlayer.js';
import { ReadView } from '../features/chill/ReadView.js';
import { MangaReader } from '../features/chill/MangaReader.js';
import { StoriesView } from '../features/chill/StoriesView.js';
import { MangaImporter } from '../features/chill/manga/MangaImporter.js';
import { SeriesView } from '../features/chill/manga/SeriesView.js';
import { autoBind } from './Component.js';
import { ProgressCard } from '../ui/ProgressCard.js';
import { ListAnimator } from '../ui/ListAnimator.js';

/**
 * Composition root. Owns one instance of every service and feature view and hands
 * itself to each of them, so components talk to each other through `this.app.<name>`
 * instead of through globals.
 */
export class App {
  constructor() {
    this.app = this;                 // so App can also be reached as `this.app`, like every other component
    autoBind(this);
    this.progress = new ProgressCard();
    this.listAnimator = new ListAnimator();
    this.store = new Store(this);
    this.toast = new Toast(this);
    this.overlays = new OverlayManager(this);
    this.theme = new ThemeManager(this);
    this.mode = new ModeManager(this);
    this.sheet = new BottomSheet(this);
    this.dialog = new Dialog(this);
    this.terms = new TermsGate(this);
    this.lock = new AppLock(this);
    this.greeter = new Greeter(this);
    this.greetPanel = new GreetingPanel(this);
    this.profile = new ProfileView(this);
    this.shell = new Shell(this);
    this.notifications = new NotificationService(this);
    this.mediaDb = new MediaDB(this);
    this.backup = new BackupService(this);
    this.thumbs = new Thumbnails(this);
    this.spending = new SpendingService(this);
    this.home = new HomeView(this);
    this.timetable = new TimetableView(this);
    this.events = new EventsView(this);
    this.tasks = new TasksView(this);
    this.people = new PeopleView(this);
    this.notes = new NotesView(this);
    this.wallet = new WalletView(this);
    this.passwords = new PasswordsView(this);
    this.settings = new SettingsView(this);
    this.chillHome = new ChillHome(this);
    this.importer = new MediaImporter(this);
    this.music = new MusicLibrary(this);
    this.audio = new AudioPlayer(this);
    this.nowPlaying = new NowPlaying(this);
    this.video = new VideoPlayer(this);
    this.read = new ReadView(this);
    this.reader = new MangaReader(this);
    this.stories = new StoriesView(this);
    this.mangaImport = new MangaImporter(this);
    this.series = new SeriesView(this);
  }

  /** The persisted user data (see Store). */
  get state() { return this.store.state; }
  set state(v) { this.store.state = v; }

  /** Start-up: wire every component (in dependency order), then do the first paint. */
  start() {
    this.listAnimator.start();
    this.overlays.init();
    this.theme.init();
    this.mode.init();
    this.settings.init();
    this.passwords.init();
    this.shell.init();
    this.timetable.init();
    this.events.init();
    this.tasks.init();
    this.people.init();
    this.notes.init();
    this.wallet.init();
    this.importer.init();
    this.mangaImport.init();
    this.sheet.init();
    this.series.init();
    this.audio.init();
    this.nowPlaying.init();
    this.music.init();
    this.video.init();
    this.read.init();
    this.reader.init();
    this.stories.init();
    this.dialog.init();
    this.backup.init();
    this.terms.init();
    this.lock.init();
    this.greeter.init();
    this.greetPanel.init();
    this.profile.init();
    this.boot();
  }

  /* Boot */
  boot() {
    this.app.home.drawHome();
    this.app.timetable.drawBoard();
    this.app.tasks.drawTasks();
    this.app.people.drawPeople();
    this.app.notes.drawNotes();
    this.app.wallet.drawWallet();
    this.app.passwords.drawPasswords();
    this.app.tasks.fillSubs();
    this.app.settings.refreshSettingsUI();
    this.app.shell.tick();
    this.app.notifications.scheduleDueTaskReminders();
    this.app.notifications.scheduleAllClassNotifications();
    this.app.terms.maybeShowTos();
    if (this.state.mode === 'chill') {
      document.querySelector('.rail-chill [data-go="chome"]')?.click();
    }
  }
}
