import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmailGateModal } from './EmailGateModal';

describe('EmailGateModal', () => {
  it('shows an inline error for an invalid email and does not call onConfirm', async () => {
    const onConfirm = vi.fn();
    render(<EmailGateModal onConfirm={onConfirm} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(screen.getByText(/correo válido/i)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm with the email when valid', async () => {
    const onConfirm = vi.fn();
    render(<EmailGateModal onConfirm={onConfirm} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'nina@example.com');
    await userEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(onConfirm).toHaveBeenCalledWith('nina@example.com');
  });

  it('exposes dialog semantics', () => {
    render(<EmailGateModal onConfirm={() => {}} onCancel={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/casi listo/i);
  });

  it('focuses the email input on mount', () => {
    render(<EmailGateModal onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText(/email/i)).toHaveFocus();
  });

  it('calls onCancel on Escape', async () => {
    const onCancel = vi.fn();
    render(<EmailGateModal onConfirm={() => {}} onCancel={onCancel} />);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('traps Tab focus within the dialog, wrapping from the last to the first element', async () => {
    render(<EmailGateModal onConfirm={() => {}} onCancel={() => {}} />);
    const confirmButton = screen.getByRole('button', { name: /confirmar/i });
    confirmButton.focus();
    await userEvent.tab();
    expect(screen.getByLabelText(/email/i)).toHaveFocus();
  });

  it('traps Shift+Tab focus, wrapping from the first to the last element', async () => {
    render(<EmailGateModal onConfirm={() => {}} onCancel={() => {}} />);
    screen.getByLabelText(/email/i).focus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: /confirmar/i })).toHaveFocus();
  });

  it('restores focus to the triggering element on unmount', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(<EmailGateModal onConfirm={() => {}} onCancel={() => {}} />);
    expect(trigger).not.toHaveFocus();
    unmount();
    expect(trigger).toHaveFocus();

    trigger.remove();
  });
});
