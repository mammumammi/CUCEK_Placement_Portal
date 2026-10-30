import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeadlineBanner } from './DeadlineBanner';

it('shows a banner when the deadline has passed', () => {
  render(<DeadlineBanner deadline="2020-01-01T00:00:00Z" />);
  expect(screen.getByRole('alert')).toHaveTextContent(/deadline has passed/i);
});
it('renders nothing before the deadline', () => {
  const { container } = render(<DeadlineBanner deadline="2999-01-01T00:00:00Z" />);
  expect(container).toBeEmptyDOMElement();
});
