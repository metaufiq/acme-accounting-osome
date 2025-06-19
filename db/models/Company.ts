import {
  Table,
  Column,
  Model,
  HasMany,
  PrimaryKey,
  AutoIncrement,
} from 'sequelize-typescript';

import { User } from './User';

interface CompanyCreateProperties {
  name: string;
}

interface CompanyProperties extends CompanyCreateProperties {
  id: number;
}

@Table({ tableName: 'companies' })
export class Company extends Model<CompanyProperties, CompanyCreateProperties> {
  @AutoIncrement
  @PrimaryKey
  @Column
  declare id: number;

  @Column
  declare name: string;

  @HasMany(() => User)
  declare users: User[];
}
