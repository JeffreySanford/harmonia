import { validate } from 'class-validator';
import { LibraryFiltersDto } from './library.dto';

describe('LibraryFiltersDto', () => {
  it('accepts showDemo=true from the frontend', async () => {
    const dto = Object.assign(
      new LibraryFiltersDto(),
      {
        showDemo: 'true',
      }
    );

    const errors =
      await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts supported library query values', async () => {
    const dto = Object.assign(
      new LibraryFiltersDto(),
      {
        type: 'song',
        sortBy: 'newest',
        showDemo: 'true',
      }
    );

    const errors =
      await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects unsupported library query values', async () => {
    const dto = Object.assign(
      new LibraryFiltersDto(),
      {
        type: 'video',
        sortBy: 'random',
        showDemo: 'false',
      }
    );

    const errors =
      await validate(dto);

    expect(errors).toHaveLength(3);
  });
});
