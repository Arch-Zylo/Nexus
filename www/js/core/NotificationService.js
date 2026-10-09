import { Component } from './Component.js';
import { LEAD_OPTIONS } from './constants.js';
import { Platform } from './Platform.js';
import { Util } from './Util.js';

export class NotificationService extends Component {
  /** @param {import('./App.js').App} app */
  constructor(app) {
    super(app);
    this.webTaskWatcherStarted = false;
    this.webClassWatcherStarted = false;
  }

  toggleNotify() {
    if (!this.state.notify) {
      this.requestNotifyPermission().then(granted => {
        this.state.notify = granted;
        this.app.store.save();
        this.app.settings.refreshSettingsUI();
        if (granted) this.scheduleDueTaskReminders();
        else this.app.toast.show('Permission denied — reminders stay off.');
      });
    } else {
      this.state.notify = false;
      this.app.store.save();
      this.app.settings.refreshSettingsUI();
      this.scheduleDueTaskReminders();
    }
  }

  checkDueReminders() {
    if (!this.state.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
    // "Due soon" includes overdue tasks (negative daysOut) as well as due today/tomorrow.
    const due = (this.state.tasks || []).filter(t => !t.done && t.due && Util.daysOut(t.due) <= 1);
    if (!due.length) return;
    const key = 'nexus-reminded-' + Util.today();
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    const titles = due.map(t => t.title).slice(0, 3).join(', ');
    new Notification('Nexus — tasks due soon', {
      body: due.length + ' task' + (due.length > 1 ? 's' : '') + ': ' + titles,
      icon: undefined
    });
  }

  startWebTaskWatcher() {
    if (this.webTaskWatcherStarted) return;
    this.webTaskWatcherStarted = true;
    // Re-check periodically so a task that becomes due while the tab stays
    // open (e.g. past midnight) still triggers a reminder without a reload.
    setInterval(this.checkDueReminders, 60000);
  }

  // Stable positive int32 id per task, used as the native notification id.
  // Offset into the upper half of the id space so task ids can never collide
  // with class notification ids (see classNotifId below).
  taskNotifId(taskId) {
    let h = 0;
    for (let i = 0; i < taskId.length; i++) h = (h * 31 + taskId.charCodeAt(i)) | 0;
    return 1073741824 + (Math.abs(h) % 1073741000) + 1;
  }

  // Due-task reminders: on the Android APK these are real, persisted
  // @capacitor/local-notifications alarms (so they still fire when the app
  // is closed); in a browser they fall back to the best-effort Web
  // Notification watcher above. Called on boot and whenever tasks change
  // (add / edit / mark done / delete) or the "Due-task reminders" setting
  // is toggled, so schedules always reflect the current task list.
  async scheduleDueTaskReminders() {
    if (Platform.isNative()) {
      const LN = window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
      if (!LN) return;
      try {
        const pending = await LN.getPending();
        const ours = (pending.notifications || []).filter(n => n.extra && n.extra.nexusTask);
        if (ours.length) await LN.cancel({ notifications: ours.map(n => ({ id: n.id })) });
      } catch {}
      if (!this.state.notify) return;
      const notifications = [];
      (this.state.tasks || []).forEach(t => {
        if (t.done || !t.due) return;
        const d = Util.daysOut(t.due);
        if (d > 60) return; // schedule up to 60 days ahead (Android caps pending alarms)
        const due = Util.parseD(t.due);
        due.setHours(9, 0, 0, 0);
        // If the 9am reminder time for that due date has already passed
        // (overdue tasks, or "due today" checked after 9am), fire shortly.
        const at = due.getTime() > Date.now() ? due : new Date(Date.now() + 3000);
        notifications.push({
          id: this.taskNotifId(t.id),
          title: d < 0 ? 'Nexus — task overdue' : 'Nexus — task due today',
          body: t.title,
          schedule: { at, allowWhileIdle: true },
          extra: { nexusTask: true, taskId: t.id }
        });
      });
      if (notifications.length) {
        try { await LN.schedule({ notifications }); } catch (e) { console.warn('Nexus: task reminder schedule failed', e); }
      }
    } else {
      this.checkDueReminders();
      this.startWebTaskWatcher();
    }
  }

  // Stable positive int32 id per class, used as the native notification id.
  classNotifId(classId) {
    let h = 0;
    for (let i = 0; i < classId.length; i++) h = (h * 31 + classId.charCodeAt(i)) | 0;
    return (Math.abs(h) % 2147483000) + 1;
  }

  // Capacitor/iOS-style weekday: Sunday=1 ... Saturday=7.
  // Our class "day" field is Monday=1 ... Friday=5.
  capWeekday(appDay) {
    return (Number(appDay) % 7) + 1;
  }

  minusMinutes(hhmm, mins) {
    const [h, m] = (hhmm || '09:00').split(':').map(Number);
    let total = h * 60 + m - Number(mins || 0);
    total = ((total % 1440) + 1440) % 1440;
    return { h: Math.floor(total / 60), m: total % 60 };
  }

  classLeadMinutes(c) {
    return c.notifyLead ? Number(c.notifyLead) : Number(this.state.classNotifyLead || 10);
  }

  async requestNotifyPermission() {
    if (Platform.isNative()) {
      const LN = window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
      if (!LN) { this.app.toast.show('Notifications plugin unavailable.'); return false; }
      try {
        const res = await LN.requestPermissions();
        return res.display === 'granted';
      } catch { return false; }
    }
    if (!('Notification' in window)) { this.app.toast.show('Notifications are not supported in this browser.'); return false; }
    try {
      const p = await Notification.requestPermission();
      return p === 'granted';
    } catch { return false; }
  }

  async scheduleAllClassNotifications() {
    if (Platform.isNative()) {
      const LN = window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
      if (!LN) return;
      try {
        const pending = await LN.getPending();
        const ours = (pending.notifications || []).filter(n => n.extra && n.extra.nexusClass);
        if (ours.length) await LN.cancel({ notifications: ours.map(n => ({ id: n.id })) });
      } catch {}
      if (!this.state.classNotify) return;
      const notifications = [];
      (this.state.classes || []).forEach(c => {
        if (c.notify === false || !c.start) return;
        const lead = this.classLeadMinutes(c);
        const { h, m } = this.minusMinutes(c.start, lead);
        notifications.push({
          id: this.classNotifId(c.id),
          title: `${c.sub} in ${lead} min`,
          body: `${Util.t12(c.start)}${c.room ? ' · ' + c.room : ''}${c.inst ? ' · ' + c.inst : ''}`,
          schedule: { on: { weekday: this.capWeekday(c.day || '1'), hour: h, minute: m }, allowWhileIdle: true },
          extra: { nexusClass: true, classId: c.id }
        });
      });
      if (notifications.length) {
        try { await LN.schedule({ notifications }); } catch (e) { console.warn('Nexus: local notification schedule failed', e); }
      }
    } else {
      this.startWebClassWatcher();
    }
  }

  startWebClassWatcher() {
    if (this.webClassWatcherStarted) return;
    this.webClassWatcherStarted = true;
    setInterval(() => {
      if (!this.state.classNotify || !('Notification' in window) || Notification.permission !== 'granted') return;
      const now = new Date();
      const appDay = now.getDay(); // Sun=0..Sat=6; classes only use 1..5
      if (appDay < 1 || appDay > 5) return;
      (this.state.classes || []).forEach(c => {
        if (c.notify === false || !c.start || Number(c.day) !== appDay) return;
        const lead = this.classLeadMinutes(c);
        const { h, m } = this.minusMinutes(c.start, lead);
        if (now.getHours() === h && now.getMinutes() === m) {
          const key = `nexus-classnotif-${c.id}-${Util.today()}`;
          if (sessionStorage.getItem(key)) return;
          sessionStorage.setItem(key, '1');
          new Notification(`${c.sub} in ${lead} min`, {
            body: `${Util.t12(c.start)}${c.room ? ' · ' + c.room : ''}${c.inst ? ' · ' + c.inst : ''}`
          });
        }
      });
    }, 20000);
  }

  toggleClassNotify() {
    if (!this.state.classNotify) {
      this.requestNotifyPermission().then(granted => {
        this.state.classNotify = granted;
        this.app.store.save();
        this.app.settings.refreshSettingsUI();
        if (granted) this.scheduleAllClassNotifications();
        else this.app.toast.show('Permission denied — timetable reminders stay off.');
      });
    } else {
      this.state.classNotify = false;
      this.app.store.save();
      this.app.settings.refreshSettingsUI();
      this.scheduleAllClassNotifications();
    }
  }

  cycleClassNotifyLead() {
    const i = LEAD_OPTIONS.indexOf(Number(this.state.classNotifyLead) || 10);
    this.state.classNotifyLead = LEAD_OPTIONS[(i + 1) % LEAD_OPTIONS.length];
    this.app.store.save();
    this.app.settings.refreshSettingsUI();
    if (this.state.classNotify) this.scheduleAllClassNotifications();
  }
}
