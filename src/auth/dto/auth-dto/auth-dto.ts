import { IsNotEmpty, IsString, Matches, Length } from 'class-validator';

export class AuthDto {
    @IsString({ message: 'Name must be a string' })
    @IsNotEmpty({ message: 'Name is required' })
    @Length(2, 100, { message: 'Name must be between 2 and 100 characters' })
    name: string;

    @IsString({ message: 'Phone number must be a string' })
    @IsNotEmpty({ message: 'Phone number is required' })
    @Matches(/^09\d{9}$/, {
        message: 'Phone number must be a valid 11-digit Iranian mobile number (e.g. 09123456789)',
    })
    @Length(11, 11, { message: 'Phone number must be exactly 11 digits' })
    phone: string;
}

export { AuthDto as AuthDtoTs };