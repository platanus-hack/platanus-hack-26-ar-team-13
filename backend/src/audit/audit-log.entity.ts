import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class AuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn()
  timestamp!: Date;

  @Column()
  company!: string;

  @Column()
  tool_name!: string;

  @Column({ nullable: true, type: 'text' })
  command!: string | null;

  @Column()
  verdict!: string;

  @Column('real')
  risk_score!: number;
}
