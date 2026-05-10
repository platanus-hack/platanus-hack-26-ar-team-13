import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class ApiClient {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  apiKey!: string;

  @Column()
  clientName!: string;

  @Column({ nullable: true, type: 'text' })
  email!: string | null;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
