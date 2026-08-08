import { UnitNotification } from '../types';

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

/**
 * Status-change events for units — the moment a listing goes pending or
 * taken, so agents don't waste a showing on something already spoken for.
 */
export const unitNotifications: UnitNotification[] = [
  {
    id: 'notif-1',
    unitId: 'unit-9',
    type: 'pending',
    message: '301 Graham Ave #2F just went Pending — application in review, hold off on showings.',
    createdAt: hoursAgo(1),
  },
  {
    id: 'notif-2',
    unitId: 'unit-13',
    type: 'pending',
    message: '1601 Ocean Ave #2A just went Pending — application submitted, awaiting approval.',
    createdAt: hoursAgo(5),
  },
  {
    id: 'notif-3',
    unitId: 'unit-6',
    type: 'taken',
    message: '88 Havemeyer St #1A is now Taken — application approved, signing Friday.',
    createdAt: hoursAgo(20),
  },
  {
    id: 'notif-4',
    unitId: 'unit-3',
    type: 'taken',
    message: '212 Bedford Ave #2C is now Taken — lease signed.',
    createdAt: hoursAgo(30),
  },
  {
    id: 'notif-5',
    unitId: 'unit-11',
    type: 'taken',
    message: '145 Driggs Ave #3R is now Taken — renewed by current tenant.',
    createdAt: hoursAgo(48),
  },
  {
    id: 'notif-6',
    unitId: 'unit-19',
    type: 'pending',
    message: '210 Nassau Ave #3A just went Pending — application in review, hold off on showings.',
    createdAt: hoursAgo(3),
  },
  {
    id: 'notif-7',
    unitId: 'unit-17',
    type: 'taken',
    message: '58 North 6th St #2A is now Taken — lease signed.',
    createdAt: hoursAgo(14),
  },
];
